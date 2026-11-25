import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

test('Alur HTTP lokal dari draf dan bukti hingga ringkasan Manajer', { timeout: 60000 }, async t => {
  const demoPassword = randomUUID();
  const child = spawn(process.execPath,[fileURLToPath(new URL('./index.js',import.meta.url))],{
    windowsHide:true, stdio:['ignore','pipe','pipe'],
    env:{...process.env,SUPABASE_DB_URL:'',VERCEL:'',BAYNET_DB:':memory:',BAYNET_DEMO:'1',BAYNET_DEMO_PASSWORD:demoPassword,NODE_ENV:'test',HOST:'127.0.0.1',PORT:'0',BAYNET_SECURE_COOKIE:'0'},
  });
  const exited = once(child,'exit');
  t.after(async () => { if (child.exitCode === null) child.kill(); await exited; });
  let diagnostic = '';
  child.stderr.on('data', data => { diagnostic += data; });
  const url = await Promise.race([
    once(child.stdout,'data').then(([chunk]) => String(chunk).match(/http:\/\/127\.0\.0\.1:\d+/)?.[0]),
    exited.then(() => { throw new Error('Server berhenti saat mulai: ' + diagnostic); }),
  ]);
  assert.ok(url);
  const request = (endpoint,method='GET',cookie='',body) => fetch(url + '/api' + endpoint,{
    method, headers:{ ...(cookie ? {Cookie:cookie} : {}), ...(body ? {'Content-Type':'application/json'} : {}) },
    ...(body ? {body:JSON.stringify(body)} : {}),
  });
  async function login(username) {
    const res = await request('/login','POST','',{username,password:demoPassword});
    assert.equal(res.status,200);
    assert.equal((await res.json()).user.username,username);
    assert.match(res.headers.get('set-cookie'),/HttpOnly/);
    return res.headers.get('set-cookie').split(';')[0];
  }
  assert.equal((await request('/me')).status,401);
  const meta = await (await request('/meta')).json();
  assert.deepEqual(meta.shifts,['Pagi','Siang']);
  assert.equal(meta.divisions.length,10);
  await t.test('Pendaftaran akun staf dan login', async () => {
    assert.deepEqual(meta.registrationDivisions, meta.divisions.filter(d => !['Supervisor','Manajer'].includes(d)));
    const account = { username:'Staf.Baru', name:'Staf Baru', division:'Teknisi', password:randomUUID() };
    const register = fields => request('/register','POST','',{...account,...fields});
    for (const fields of [{division:'Supervisor'},{division:'Manajer'},{password:randomUUID().slice(0,5)},{username:'!'},{name:' '}]) {
      assert.equal((await register(fields)).status,400);
    }
    assert.equal((await register({role:'manager',reviewDivisions:['Teknisi']})).status,201);
    assert.equal((await register({username:'staf.baru',password:randomUUID()})).status,409);
    const loggedIn = await request('/login','POST','',{username:account.username,password:account.password});
    assert.equal(loggedIn.status,200);
    const cookie = loggedIn.headers.get('set-cookie').split(';')[0];
    const me = await request('/me','GET',cookie);
    assert.equal(me.status,200);
    const {user} = await me.json();
    assert.equal(user.username,'staf.baru');
    assert.equal(user.name,account.name);
    assert.equal(user.division,account.division);
    assert.equal(user.role,'staff');
    assert.deepEqual(user.reviewDivisions,[]);
  });
  const staff = await login('helpdesk'), sup = await login('supervisor'), manager = await login('manajer');
  const form = {date:'2025-03-12',shift:'Siang',activities:[{activity:'Tutup tiket',result:'Dua tiket selesai.',obstacle:'',followUp:'Hubungi pelanggan.',detail:'HD-011'}]};
  const created = await request('/reports','POST',staff,form);
  assert.equal(created.status,201);
  let {report} = await created.json();
  const path = '/reports/' + report.id;
  assert.equal((await request('/reports','POST',staff,form)).status,409);
  const added = await request(path + '/attachments','POST',staff,{name:'bukti.pdf',mime:'application/pdf',data:Buffer.from('%PDF-1.6\n%%EOF').toString('base64')});
  assert.equal(added.status,201);
  ({report} = await added.json());
  const attachment = '/attachments/' + report.attachments[0].id;
  assert.equal((await request(attachment,'GET',sup)).status,404);
  ({report} = await (await request(path + '/submit','POST',staff,{version:report.version})).json());
  assert.equal(report.status,'submitted');
  const download = await request(attachment,'GET',sup);
  assert.match(download.headers.get('content-disposition'),/attachment/);
  assert.equal(await download.text(),'%PDF-1.6\n%%EOF');
  assert.equal((await request(path,'GET',manager)).status,404);
  ({report} = await (await request(path + '/review','POST',sup,{action:'approve',version:report.version})).json());
  assert.equal(report.status,'supervisor_approved');
  ({report} = await (await request(path + '/review','POST',manager,{action:'approve',version:report.version})).json());
  assert.equal(report.status,'approved');
  const brief = await (await request('/summary?date=' + form.date + '&shift=Siang','GET',manager)).json();
  assert.equal(brief.divisions.length,8);
  assert.equal(brief.totals.approved,1);
  assert.deepEqual(brief.divisions.find(g => g.division === 'Helpdesk').followUps,['Hubungi pelanggan.']);
  await request('/logout','POST',staff);
  assert.equal((await request('/me','GET',staff)).status,401);
});
