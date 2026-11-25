import { parseArgs } from 'node:util';
import { addUser, approveAccount } from './accounts.js';
import { divisions } from './config.js';

try {
  const { values } = parseArgs({options:{
    approve:{type:'boolean'},username:{type:'string'},name:{type:'string'},division:{type:'string'},role:{type:'string'},review:{type:'string',default:''},
  }});
  const password = process.env.BAYNET_ACCOUNT_PASSWORD;
  if (!values.approve && !password) throw new Error('Isi variabel lingkungan BAYNET_ACCOUNT_PASSWORD untuk akun baru.');
  const reviewDivisions = values.review.split(',').map(v => v.trim()).filter(Boolean);
  const id = values.approve ? await approveAccount(values.username,values.division,reviewDivisions) : await addUser({...values,reviewDivisions,password});
  console.log('Akun ' + values.username + ' berhasil diaktifkan dengan ID ' + id + '.');
} catch (error) {
  console.error(error.message.includes('UNIQUE constraint') ? 'Nama pengguna telah dipakai.' : error.message);
  console.error('Contoh: node server/account.js --username dina --name "Dina Putri" --division Helpdesk');
  console.error('Peran: staff, supervisor, manager. Pilihan divisi: ' + divisions.join(', ') + '.');
  process.exitCode = 1;
}
