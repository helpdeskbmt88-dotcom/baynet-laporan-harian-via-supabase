import express from 'express';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { attachmentDivisions, divisions, host, operational, port, regularDivisions, root, shifts, todayWIB } from './config.js';
import { addUser, authenticate, closeSession, makeSession, sessionUser } from './accounts.js';
import { hasDemo, seedDemo } from './seed.js';
import { ApiError, addAttachment, attachment, deleteReport, getReport, listReports, reviewReport, saveReport, submitReport, summary } from './reports.js';

if (!process.env.SUPABASE_DB_URL && !process.env.VERCEL && process.env.BAYNET_DEMO !== '0' && process.env.BAYNET_DEMO_PASSWORD && process.env.NODE_ENV !== 'production') await seedDemo();
const app = express();
app.disable('x-powered-by');
const api = express.Router();
const cookie = 'baynet_session';
const cookieOptions = { httpOnly:true, sameSite:'strict', path:'/', secure:process.env.VERCEL === '1' || process.env.BAYNET_SECURE_COOKIE === '1' };
const tokenFrom = req => req.headers.cookie?.split(';').map(part => part.trim()).find(part => part.startsWith(cookie+'='))?.slice(cookie.length+1);

api.use((req,res,next) => {
  res.set('Cache-Control','no-store');
  res.set('X-Content-Type-Options','nosniff');
  // Same-origin writes also work through Vite's local development proxy.
  if (!['GET','HEAD','OPTIONS'].includes(req.method)) {
    const origin = req.get('Origin');
    if (req.get('Sec-Fetch-Site') === 'cross-site') return next(new ApiError(403,'Permintaan lintas situs ditolak.'));
    if (origin) {
      let source;
      try { source = new URL(origin); } catch { return next(new ApiError(403,'Asal permintaan tidak valid.')); }
      const local = ['localhost','127.0.0.1','[::1]'];
      const allowed = source.host === req.get('host') || (local.includes(source.hostname) && local.includes(req.hostname)) || origin === process.env.BAYNET_ORIGIN;
      if (!allowed) return next(new ApiError(403,'Asal permintaan tidak diizinkan.'));
    }
  }
  next();
});
api.use(express.json({ limit:'4600kb' }));
api.get('/meta', async (_req,res) => res.json({divisions,registrationDivisions:divisions,attachmentDivisions,regularDivisions,shifts,today:todayWIB(),demo:await hasDemo()}));
api.post('/register', async (req,res) => {
  const { username, name, division, password } = req.body || {};
  if (!divisions.includes(division)) throw new ApiError(400,'Pilih divisi yang tersedia.');
  const pending = !operational.includes(division);
  await addUser({ username, name, division, password, role:pending ? 'pending' : 'staff' });
  res.status(201).json({ok:true,pending});
});
const attempts = new Map();
api.post('/login', async (req,res) => {
  const ip = req.socket.remoteAddress || 'local';
  const attempt = attempts.get(ip);
  if (attempt?.expires > Date.now() && attempt.count >= 25) throw new ApiError(429,'Terlalu banyak percobaan. Coba lagi dalam sepuluh menit.');
  const user = await authenticate(req.body?.username,req.body?.password);
  if (!user) {
    attempts.set(ip,attempt?.expires > Date.now() ? {...attempt,count:attempt.count+1} : {count:1,expires:Date.now()+600000});
    throw new ApiError(401,'Nama pengguna atau kata sandi salah.');
  }
  attempts.delete(ip);
  await closeSession(tokenFrom(req));
  res.cookie(cookie,await makeSession(user.id),{...cookieOptions,maxAge:12*3600000}).json({user});
});
api.post('/logout', async (req,res) => { await closeSession(tokenFrom(req)); res.clearCookie(cookie,cookieOptions).json({ok:true}); });
api.use(async (req,_res,next) => {
  req.user = await sessionUser(tokenFrom(req));
  next(req.user ? undefined : new ApiError(401,'Silakan masuk untuk melanjutkan.'));
});
api.get('/me', (req,res) => res.json({user:req.user}));
api.get('/summary', async (req,res) => res.json(await summary(req.user,req.query)));
api.use((req,_res,next) => next(req.user.role === 'director' ? new ApiError(403,'Akun Direktur memiliki akses ringkasan.') : undefined));
api.get('/reports', async (req,res) => res.json({reports:await listReports(req.user,req.query)}));
api.post('/reports', async (req,res) => res.status(201).json({report:await saveReport(req.user,null,req.body || {})}));
api.param('id', (req,_res,next,id) => {
  if (!/^[1-9]\d*$/.test(id) || !Number.isSafeInteger(Number(id))) return next(new ApiError(404,'Data tidak ditemukan.'));
  req.recordId = Number(id);
  next();
});
api.get('/reports/:id', async (req,res) => res.json({report:await getReport(req.user,req.recordId)}));
api.put('/reports/:id', async (req,res) => res.json({report:await saveReport(req.user,req.recordId,req.body || {})}));
api.delete('/reports/:id', async (req,res) => { await deleteReport(req.user,req.recordId,req.body?.version); res.json({ok:true}); });
api.post('/reports/:id/submit', async (req,res) => res.json({report:await submitReport(req.user,req.recordId,req.body?.version)}));
api.post('/reports/:id/review', async (req,res) => res.json({report:await reviewReport(req.user,req.recordId,req.body || {})}));
api.post('/reports/:id/attachments', async (req,res) => res.status(201).json({report:await addAttachment(req.user,req.recordId,req.body || {})}));
api.delete('/attachments/:id', async (req,res) => res.json({report:await attachment(req.user,req.recordId,true)}));
api.get('/attachments/:id', async (req,res) => {
  const file = await attachment(req.user,req.recordId);
  res.setHeader('Content-Security-Policy',"default-src 'none'; sandbox");
  res.attachment(file.name).type(file.mime).send(file.data);
});
api.use((_req,_res,next) => next(new ApiError(404,'Endpoint tidak ditemukan.')));
app.use('/api',api);
const dist = path.join(root,'dist');
if (existsSync(path.join(dist,'index.html'))) {
  app.use(express.static(dist));
  app.get(/.*/, (_req,res) => res.sendFile(path.join(dist,'index.html')));
}
app.use((error,_req,res,_next) => {
  let {status,message} = error;
  if (!(error instanceof ApiError)) {
    if (error.type === 'entity.too.large') { status=413; message='File terlalu besar untuk diunggah.'; }
    else if (error.type === 'entity.parse.failed') { status=400; message='Isi permintaan bukan JSON yang valid.'; }
    else { console.error(error); status=500; message='Terjadi kesalahan saat memproses data. Coba lagi.'; }
  }
  res.status(status).json({error:message,...(error.fields ? {fields:error.fields} : {})});
});
export default app;
if (!process.env.VERCEL) {
  const server = app.listen(port,host,() => console.log('BAYNET berjalan di http://' + host + ':' + server.address().port));
  server.on('error',error => { console.error('Server gagal dimulai: ' + error.message); process.exitCode = 1; });
}
