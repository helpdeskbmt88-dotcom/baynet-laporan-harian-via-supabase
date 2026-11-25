import { pathToFileURL } from 'node:url';
import { db, transaction } from './db.js';
import { addUser } from './accounts.js';
import { financial, operational, regularDivisions, todayWIB } from './config.js';
import { addHistory } from './reports.js';

const slug = division => division.toLowerCase().replaceAll(' ','-');
const general = operational.filter(d => !financial.includes(d));
const examples = [
  ['NOC', 'Raka Pratama', 'Pemantauan jaringan backbone', 'Tiga jalur utama stabil setelah penyesuaian routing.', 'Latensi jalur timur meningkat saat jam sibuk.', 'Pantau tren latensi pada shift berikutnya.', 'POP Timur • 12 menit'],
  ['Helpdesk', 'Dina Putri', 'Penanganan tiket gangguan', 'Sembilan dari sebelas tiket pelanggan selesai.', 'Dua tiket menunggu konfirmasi pelanggan.', 'Hubungi kembali pelanggan pada shift siang.', 'HD-0241 hingga HD-0251'],
  ['Customer Service', 'Nadia Rahma', 'Tindak lanjut permintaan pelanggan', 'Enam pelanggan menerima jadwal pemasangan.', '', 'Kirim pengingat satu hari sebelum pemasangan.', '6 permintaan pemasangan'],
  ['Teknisi', 'Fajar Saputra', 'Instalasi pelanggan baru', 'Empat instalasi selesai dan koneksi telah diuji.', 'Satu kunjungan tertunda karena akses rumah terkunci.', 'Jadwalkan kunjungan ulang bersama Customer Service.', 'Area Cijaya • FTTH'],
  ['Gudang', 'Arif Maulana', 'Distribusi perangkat lapangan', 'Delapan unit ONT dan dua gulung kabel diserahkan ke Teknisi.', '', 'Cocokkan sisa stok ONT dengan kartu stok.', 'ONT • keluar 8 unit'],
  ['Cleaning Service', 'Sari Wulandari', 'Pembersihan area layanan', 'Ruang layanan dan ruang rapat siap digunakan.', '', 'Periksa kembali ruang layanan setelah istirahat.', 'Lantai 1 • ruang layanan'],
  ['Finance', 'Aulia Fitri', 'Verifikasi penerimaan harian', 'Penerimaan hari ini sudah dicocokkan dengan mutasi bank.', '', 'Kirim hasil rekonsiliasi ke Accounting.', 'Rekonsiliasi kas masuk'],
  ['Accounting', 'Bima Santoso', 'Pencatatan jurnal operasional', 'Dokumen pembelian sudah dicatat dalam jurnal.', 'Satu bukti transaksi menunggu verifikasi.', 'Minta konfirmasi dari penanggung jawab.', 'Jurnal pembelian'],
];

export async function seedDemo() {
  return transaction(async () => {
    if ((await db.get('SELECT CAST(COUNT(*) AS INTEGER) AS n FROM users')).n) return false;
    const password = process.env.BAYNET_DEMO_PASSWORD;
    if (!password || password.length < 10 || password.length > 200) {
      throw new Error('Tetapkan BAYNET_DEMO_PASSWORD sepanjang 10–200 karakter untuk membuat akun demo.');
    }
    const accounts = {};
    for (const [division,name] of examples) {
      accounts[division] = await addUser({username:slug(division),name,division,role:'staff',password});
    }
    const supervisor = await addUser({username:'supervisor',name:'Dimas Pratama',division:'Supervisor',role:'supervisor',reviewDivisions:general,password});
    const manager = await addUser({username:'manajer',name:'Aditya Wijaya',division:'Manajer',role:'manager',reviewDivisions:general,password});
    const financeSupervisor = await addUser({username:'supervisor-keuangan',name:'Ratih Kusuma',division:'Supervisor',role:'supervisor',reviewDivisions:financial,password});
    const financeManager = await addUser({username:'manajer-keuangan',name:'Ayu Lestari',division:'Manajer',role:'manager',reviewDivisions:financial,password});
    const date = todayWIB();
    const previous = new Date(Date.parse(date + 'T12:00:00Z') - 86400000).toISOString().slice(0,10);
    const sample = async (division,owner,day,shift,status,activities,index) => {
      const timestamp = hour => new Date(day + 'T' + hour + ':' + String(index * 5 % 60).padStart(2,'0') + ':00+07:00').toISOString();
      const sequence = [['draft', owner, '',timestamp('07')]];
      if (status !== 'draft') sequence.push(['submitted',owner,'',timestamp('09')]);
      if (['supervisor_approved','approved'].includes(status)) sequence.push(['supervisor_approved', financial.includes(division) ? financeSupervisor : supervisor,'Isi laporan telah diperiksa.',timestamp('10')]);
      if (status === 'approved') sequence.push(['approved',financial.includes(division) ? financeManager : manager,'',timestamp('11')]);
      if (status === 'revision') sequence.push(['revision',supervisor,'Mohon lengkapi hasil pekerjaan dan rencana tindak lanjut.',timestamp('10')]);
      const slot = regularDivisions.includes(division) ? 'Harian' : shift;
      const id = (await db.get('INSERT INTO reports(author_id,date,shift,slot,status,activities,version,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?) RETURNING id', owner,day,shift,slot,status,JSON.stringify(activities),sequence.length,sequence[0][3],sequence.at(-1)[3])).id;
      for (const item of sequence) await addHistory(id,...item);
    };
    const stages = ['supervisor_approved','supervisor_approved','submitted','approved','supervisor_approved','approved','supervisor_approved','approved'];
    for (const [i, [division,,activity,result,obstacle,followUp,detail]] of examples.entries()) {
      const a = {activity,result,obstacle,followUp,detail};
      await sample(division,accounts[division],date,'Pagi',stages[i],[a],i);
      await sample(division,accounts[division],previous,'Pagi','approved',[a],i);
    }
    await sample('Helpdesk',accounts.Helpdesk,date,'Siang','submitted',[{activity:'Serah terima tiket',result:'Dua tiket diteruskan ke tim lapangan.',obstacle:'',followUp:'Periksa jawaban tim lapangan.',detail:'HD-0252'}],9);
    await sample('Supervisor',supervisor,date,'Pagi','submitted',[{activity:'Koordinasi shift operasional',result:'Tim pagi telah menyerahkan prioritas penanganan gangguan.',obstacle:'',followUp:'Pastikan dua tiket tertunda mendapatkan pembaruan.',detail:'Koordinasi lintas divisi'}],3);
    await db.run('INSERT INTO settings(key,value) VALUES(?,?)', 'demo','1');
    return true;
  });
}
export const hasDemo = async () => (await db.get("SELECT value FROM settings WHERE key='demo'"))?.value === '1';
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  console.log(await seedDemo() ? 'Akun dan laporan contoh BAYNET berhasil dibuat.' : 'Database sudah berisi akun. Data yang ada tetap tersimpan.');
}
