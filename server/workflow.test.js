import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';

process.env.BAYNET_DB = ':memory:';
const demoPassword = randomUUID();
process.env.BAYNET_DEMO_PASSWORD = demoPassword;
delete process.env.SUPABASE_DB_URL;
delete process.env.VERCEL;
const { seedDemo } = await import('./seed.js');
const { addUser, approveAccount, authenticate, makeSession, closeSession, sessionUser } = await import('./accounts.js');
const { saveReport, getReport, listReports, summary, submitReport, reviewReport, deleteReport, attachment, addAttachment } = await import('./reports.js');
await seedDemo();
const login = async username => await authenticate(username,demoPassword);
const agent = await login('helpdesk');
const supervisor = await login('supervisor');
const manager = await login('manajer');
const finance = await login('finance');
const date = '2025-04-02';
const activity = {activity:'Penanganan tiket',result:'Tiket terselesaikan',obstacle:'Menunggu konfirmasi',followUp:'Hubungi pelanggan',detail:'HD-123'};
const form = {date,shift:'Pagi',activities:[activity]};
const isError = status => error => error.status === status;

test('Tautan persetujuan hanya memproses satu pengajuan dan sekali pakai', async () => {
  const { createHash,randomBytes } = await import('node:crypto');
  const { db } = await import('./db.js');
  const { reviewRegistration } = await import('./account-review.js');
  for (const action of ['approve','reject']) {
    const username = 'uji-' + action;
    const id = await addUser({username,name:'Uji',division:'Supervisor',password:demoPassword,role:'pending'});
    const token = randomBytes(32).toString('hex');
    const key = 'review:' + createHash('sha256').update(token).digest('hex');
    await db.run('INSERT INTO settings(key,value) VALUES(?,?)',key,JSON.stringify({id,expires:Date.now()+60000}));
    assert.equal((await reviewRegistration({token,action:'inspect'})).user.username,username);
    await assert.rejects(() => authenticate(username,demoPassword),isError(403));
    await reviewRegistration({token,action,reviewDivisions:['NOC']});
    await assert.rejects(() => reviewRegistration({token,action}),isError(410));
    if (action === 'reject') await assert.rejects(() => authenticate(username,demoPassword),isError(403));
    else assert.deepEqual((await authenticate(username,demoPassword)).reviewDivisions,['NOC']);
  }
});

test('Sesi tersimpan dan dapat diakhiri', async () => {
  assert.equal(await authenticate('helpdesk',randomUUID()),null);
  const token = await makeSession(agent.id);
  assert.equal((await sessionUser(token)).id,agent.id);
  await closeSession(token);
  assert.equal(await sessionUser(token),null);
});
test('Draf, bukti, revisi, dua tingkat persetujuan, dan ringkasan per shift', async () => {
  let report = await saveReport(agent,null,{...form,activities:[]});
  await assert.rejects(async () => await submitReport(agent,report.id,report.version),isError(422));
  await assert.rejects(async () => await saveReport(agent,null,form),isError(409));
  await assert.rejects(async () => await saveReport(agent,report.id,{...form,version:report.version+3}),isError(409));
  report = await saveReport(agent,report.id,{...form,version:report.version});
  await assert.rejects(async () => await addAttachment(agent,report.id,{name:'bukti.png',mime:'image/png',data:'YWJj'}),isError(422));
  const data = Buffer.from('%PDF-1.4\n%%EOF').toString('base64');
  report = await addAttachment(agent,report.id,{name:'Bukti.pdf',mime:'application/pdf',data});
  const fid = report.attachments[0].id;
  await assert.rejects(async () => await attachment(supervisor,fid),isError(404));
  await assert.rejects(async () => await getReport(await login('noc'),report.id),isError(404));
  report = await submitReport(agent,report.id,report.version);
  assert.equal(report.status,'submitted');
  assert.equal((await attachment(supervisor,fid)).data.toString('base64'),data);
  assert.equal((await summary(manager,{date})).totals.reports,0);
  assert.equal((await summary(supervisor,{date})).divisions.find(g=>g.division==='Helpdesk').points.length,1);
  report = await reviewReport(supervisor,report.id,{action:'revise',note:'Lengkapi kolom hasil.',version:report.version});
  assert.equal((await getReport(agent,report.id)).canEdit,true);
  await assert.rejects(async () => await deleteReport(agent,report.id),isError(409));
  report = await submitReport(agent,report.id,report.version);
  report = await reviewReport(supervisor,report.id,{action:'approve',version:report.version});
  assert.equal(report.status,'supervisor_approved');
  let group = (await summary(manager,{date,shift:'Pagi'})).divisions.find(g=>g.division==='Helpdesk');
  assert.deepEqual(group.obstacles,[activity.obstacle]);
  assert.equal(group.count,1);
  assert.equal((await summary(manager,{date,shift:'Siang'})).totals.reports,0);
  report = await reviewReport(manager,report.id,{action:'revise',note:'Perjelas tindak lanjut.',version:report.version});
  assert.equal(report.status,'revision');
  report = await submitReport(agent,report.id,report.version);
  report = await reviewReport(supervisor,report.id,{action:'approve',version:report.version});
  report = await reviewReport(manager,report.id,{action:'approve',version:report.version});
  assert.equal(report.status,'approved');
  assert.equal(report.history.length,9);
  await assert.rejects(async () => await saveReport(agent,report.id,{...form,version:report.version}),isError(403));
  const afternoon = await saveReport(agent,null,{...form,shift:'Siang'});
  await deleteReport(agent,afternoon.id);
  await assert.rejects(async () => await getReport(agent,afternoon.id),isError(404));
});
test('Rincian keuangan tersedia hanya bagi peninjau yang ditunjuk', async () => {
  const finSupervisor = await login('supervisor-keuangan'), finManager = await login('manajer-keuangan');
  let report = await saveReport(finance,null,form);
  await assert.rejects(async () => await saveReport(finance,null,{...form,shift:'Siang'}),isError(409));
  await assert.rejects(async () => await addAttachment(finance,report.id,{}),isError(403));
  report = await submitReport(finance,report.id,report.version);
  await assert.rejects(async () => await getReport(supervisor,report.id),isError(404));
  report = await reviewReport(finSupervisor,report.id,{action:'approve',version:report.version});
  await assert.rejects(async () => await getReport(manager,report.id),isError(404));
  assert.equal((await listReports(manager,{date,division:'Finance'})).length,0);
  const group = (await summary(manager,{date})).divisions.find(g=>g.division==='Finance');
  assert.deepEqual([group.count,group.restricted,group.points,group.obstacles,group.followUps],[1,true,[],[],[]]);
  assert.equal((await summary(finManager,{date})).divisions.find(g=>g.division==='Finance').points.length,1);
  assert.equal((await reviewReport(finManager,report.id,{action:'approve',version:report.version})).status,'approved');
});
test('Laporan pribadi Supervisor diteruskan ke Manajer dan laporan Manajer langsung tercatat', async () => {
  let report = await saveReport(supervisor,null,form);
  report = await submitReport(supervisor,report.id,report.version);
  assert.equal((await getReport(manager,report.id)).canReview,true);
  report = await reviewReport(manager,report.id,{action:'approve',version:report.version});
  assert.equal(report.status,'approved');
  let own = await saveReport(manager,null,form);
  assert.equal((await submitReport(manager,own.id,own.version)).status,'approved');
  assert.equal((await summary(manager,{date})).divisions.length,8);
  await addUser({username:'direktur',name:'Direktur',division:'Direktur',role:'pending',password:demoPassword});
  await approveAccount('direktur','Direktur',[]);
  const director = await login('direktur');
  const result = await summary(director,{date,shift:'Pagi'});
  assert.deepEqual(result.divisions.map(g => [g.division,g.count]),[['Manajer',1],['Supervisor',1]]);
  assert.ok(result.divisions.every(g => g.points.length === 1));
  assert.equal((await summary(director,{date,shift:'Siang'})).totals.reports,0);
});

test('Hak meninjau tidak melewati dua tingkat persetujuan untuk laporan divisi operasional', async () => {
  const account = {username:'pengawas-noc',name:'Pengawas NOC',division:'NOC',role:'manager',reviewDivisions:['NOC'],password:randomUUID()};
  await addUser(account);
  const author = await authenticate(account.username,account.password);
  let report = await saveReport(author,null,{...form,date:'2025-04-03'});
  report = await submitReport(author,report.id,report.version);
  assert.equal(report.status,'submitted');
  await assert.rejects(async () => await reviewReport(author,report.id,{action:'approve',version:report.version}),isError(403));
  await assert.rejects(async () => await getReport(manager,report.id),isError(404));
  report = await reviewReport(supervisor,report.id,{action:'approve',version:report.version});
  await assert.rejects(async () => await reviewReport(author,report.id,{action:'approve',version:report.version}),isError(403));
  assert.equal((await reviewReport(manager,report.id,{action:'approve',version:report.version})).status,'approved');
  await assert.rejects(async () => await addUser({...account,username:'sup-tanpa-divisi',division:'Supervisor',role:undefined,reviewDivisions:[]}),/divisi tinjauan/);
});

test('Tanggal, dua shift, batas harian, dan perlindungan versi berlaku saat membuat serta mengubah', async () => {
  await assert.rejects(async () => await saveReport(agent,null,{...form,shift:'Malam'}),isError(422));
  await assert.rejects(async () => await saveReport(agent,null,{...form,date:'2025-02-29'}),isError(422));
  const d = '2025-04-04';
  const pagi = await saveReport(agent,null,{...form,date:d});
  const siang = await saveReport(agent,null,{...form,date:d,shift:'Siang'});
  await assert.rejects(async () => await saveReport(agent,siang.id,{...form,date:d,version:siang.version}),isError(409));
  assert.equal((await getReport(agent,siang.id)).shift,'Siang');
  await assert.rejects(async () => await deleteReport(agent,pagi.id,pagi.version+1),isError(409));
  await assert.rejects(async () => await deleteReport(supervisor,pagi.id,pagi.version),isError(404));
  await deleteReport(agent,pagi.id,pagi.version);
  await deleteReport(agent,siang.id,siang.version);
  const future = await saveReport(agent,null,{...form,date:'2099-02-28'});
  await assert.rejects(async () => await submitReport(agent,future.id,future.version),isError(422));
});

test('Lima divisi bukti, batas ukuran dan jumlah, percobaan berulang, dan penghapusan lampiran', async () => {
  const allowed = ['gudang','customer-service','helpdesk','noc','cleaning-service'];
  const blocked = ['teknisi','finance','accounting','supervisor','manajer'];
  const d = '2025-04-05';
  const evidence = n => ({name:'bukti-' + n + '.pdf',mime:'application/pdf',data:Buffer.from('%PDF-1.7\n' + n + '\n%%EOF').toString('base64')});
  for (const username of [...allowed,...blocked]) {
    const user = await login(username);
    const draft = await saveReport(user,null,{...form,date:d});
    if (blocked.includes(username)) {
      await assert.rejects(async () => await addAttachment(user,draft.id,evidence(1)),isError(403));
      continue;
    }
    const report = await addAttachment(user,draft.id,evidence(1));
    assert.equal(report.attachments.length,1);
    assert.equal((await addAttachment(user,draft.id,evidence(1))).version,report.version);
    const id = report.attachments[0].id;
    await assert.rejects(async () => await attachment(await login('teknisi'),id,true),isError(404));
    assert.equal((await attachment(user,id,true)).attachments.length,0);
    await assert.rejects(async () => await attachment(user,id),isError(404));
    if (username !== 'helpdesk') continue;
    await assert.rejects(async () => await addAttachment(user,draft.id,{...evidence(1),data:'A'.repeat(4*1024*1024+4)}),isError(422));
    for (let i=1;i<=5;i++) await addAttachment(user,draft.id,evidence(i));
    await assert.rejects(async () => await addAttachment(user,draft.id,evidence(6)),isError(422));
    assert.equal((await addAttachment(user,draft.id,evidence(5))).attachments.length,5);
    await deleteReport(user,draft.id,(await getReport(user,draft.id)).version);
    await assert.rejects(async () => await attachment(user,id),isError(404));
  }
});
