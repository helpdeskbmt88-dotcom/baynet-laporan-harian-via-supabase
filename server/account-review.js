import { createHash } from 'node:crypto';
import { db, transaction } from './db.js';
import { approveAccount } from './accounts.js';
import { operational } from './config.js';
import { ApiError } from './errors.js';

export async function reviewRegistration({ token, action, reviewDivisions = [] }) {
  if (typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token)) throw new ApiError(403,'Tautan tidak valid.');
  const key = 'review:' + createHash('sha256').update(token).digest('hex');
  return transaction(async () => {
    const saved = await db.get('SELECT value FROM settings WHERE key=?',key);
    if (!saved) throw new ApiError(410,'Tautan sudah digunakan atau tidak berlaku.');
    const { id, expires } = JSON.parse(saved.value);
    if (expires <= Date.now()) throw new ApiError(410,'Tautan sudah kedaluwarsa.');
    const user = await db.get("SELECT id,username,division FROM users WHERE id=? AND role='pending'",id);
    if (!user) throw new ApiError(410,'Pengajuan ini sudah diproses.');
    if (action === 'inspect') return { user, divisions:operational };
    if (action === 'approve') {
      if (!Array.isArray(reviewDivisions) || reviewDivisions.some(d => !operational.includes(d)) ||
          (user.division === 'Direktur' ? reviewDivisions.length : !reviewDivisions.length)) {
        throw new ApiError(400,'Periksa pilihan divisi tinjauan.');
      }
      await approveAccount(user.username,user.division,reviewDivisions);
    } else if (action === 'reject') {
      await db.run("UPDATE users SET role='rejected' WHERE id=? AND role='pending'",id);
    } else throw new ApiError(400,'Pilih tindakan yang tersedia.');
    await db.run('DELETE FROM settings WHERE key=?',key);
    return { ok:true };
  });
}
