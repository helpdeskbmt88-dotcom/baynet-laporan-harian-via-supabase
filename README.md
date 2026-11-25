# Laporan Harian BAYNET

Aplikasi lokal berbahasa Indonesia untuk pelaporan 10 divisi. Delapan divisi operasional mengirim laporan ke Supervisor, lalu ke Manajer. Peninjau membuka ringkasan hasil, kendala, dan tindak lanjut berdasarkan tanggal serta shift. Data, bukti, dan riwayat persetujuan tersimpan di SQLite pada komputer yang menjalankan server.

## Menjalankan aplikasi

Gunakan Node.js 22.13 atau lebih baru dan npm. Dari PowerShell, buka folder proyek ini, lalu jalankan langkah berikut untuk pemasangan pertama.

```powershell
npm.cmd ci
Copy-Item .env.example .env
npm.cmd run build
npm.cmd start
```

Buka [Laporan Harian BAYNET](http://127.0.0.1:3001). Pada startup pertama server membuat database dan skema. Untuk menambahkan akun dan laporan contoh pada database lokal yang masih kosong, isi `BAYNET_DEMO_PASSWORD` di lingkungan server dengan kata sandi pribadi sepanjang 10–200 karakter sebelum memulai server. Startup berikutnya memakai data yang sama. Untuk menjalankan kembali hasil build, cukup jalankan `npm.cmd start`. Tekan Ctrl+C di terminal server untuk menghentikannya.

Untuk mengembangkan frontend dan API bersamaan, jalankan `npm.cmd run dev` dan buka [server pengembangan](http://127.0.0.1:5173). Perintah ini menggunakan port API yang sama dengan `npm.cmd start`, jadi jalankan salah satunya. Untuk terminal terpisah gunakan `npm.cmd run dev:api` dan `npm.cmd run dev:web`. Aset foto, logo, ikon, dan font disajikan secara lokal.

## Mencoba tiga peran

Pada layar masuk, klik **Coba akun demo**, tentukan pengguna, lalu klik **Pilih akun**. Masukkan kata sandi yang ditetapkan saat akun demo dibuat dan klik **Masuk**. Pengaturan `BAYNET_DEMO_PASSWORD` berlaku saat pembuatan akun baru.

| Akun contoh | Akses |
| --- | --- |
| `noc`, `helpdesk`, `customer-service`, `teknisi`, `gudang`, `cleaning-service`, `finance`, `accounting` | Membuat dan melihat laporan pribadi sesuai divisi |
| `supervisor`, `manajer` | Meninjau enam divisi operasional umum sesuai tahap masing-masing |
| `supervisor-keuangan`, `manajer-keuangan` | Meninjau Finance dan Accounting sesuai tahap masing-masing |

Untuk mencoba satu siklus penuh, masuk sebagai **NOC**, pilih shift siang pada tanggal contoh, isi aktivitas dan hasil kerja, lalu kirim laporan. Keluar dan masuk sebagai **Supervisor** untuk membaca ringkasan dan memilih **Setujui & teruskan**. Masuk sebagai **Manajer** untuk persetujuan akhir. Peninjau juga dapat meminta revisi dengan catatan. Laporan operasional yang diperbaiki penulis akan melewati kedua tingkat lagi.

## Aturan laporan

- Shift **Pagi** dan **Siang** dipilih saat mengisi laporan. Tanggal kerja menggunakan WIB. NOC, Helpdesk, Customer Service, Teknisi, Gudang, dan Cleaning Service dapat mencatat satu laporan per orang untuk setiap tanggal dan shift.
- Manajer, Supervisor, Finance, dan Accounting menggunakan satu laporan per orang per tanggal. Shift yang dipilih tetap dicatat. Daftar tim harian dapat disesuaikan melalui `regularDivisions` di `server/config.js` sebelum penggunaan operasional.
- Laporan dapat berisi sampai 30 aktivitas. Tiap aktivitas mempunyai hasil kerja, kendala, tindak lanjut, serta kolom khusus divisi. Penulis dapat menyimpan dan menghapus draf, membuka riwayat, dan memperbaiki laporan yang dikembalikan.
- Lampiran bersifat opsional untuk **Gudang, Customer Service, Helpdesk, NOC, dan Cleaning Service**. Batas per laporan adalah lima file JPG, PNG, WebP, atau PDF, maksimal 3 MiB per file. Server memeriksa divisi, hak akses, ukuran, ekstensi, dan tanda pengenal format file.
- Ringkasan delapan divisi disusun lokal dari kolom laporan yang sudah dikirim. Sistem mengambil maksimal lima poin berbeda per kategori per divisi untuk setiap periode, dengan laporan yang terakhir diperbarui didahulukan. Manajer menerima poin setelah persetujuan Supervisor. Peninjau di luar penugasan hanya melihat status/jumlah pengumpulan divisi tersebut.
- Supervisor dapat mengirim laporan pribadi kepada Manajer yang wilayah penugasannya beririsan. Laporan Manajer langsung selesai saat dikirim. Keduanya dapat ditemukan melalui daftar laporan sesuai hak akses. Rekap delapan divisi berfokus pada laporan tim operasional.

## Data lokal dan akun kerja

Konfigurasi contoh menggunakan `data/baynet.sqlite`. Pengaturan `HOST=127.0.0.1` membatasi akses ke komputer lokal. Untuk menyiapkan data kerja terpisah, atur `BAYNET_DEMO=0` dan arahkan `BAYNET_DB` di `.env` ke file baru, misalnya `./data/operasional.sqlite`. Pengaturan ini berlaku saat startup dan akun baru memakai database dari konfigurasi yang sama.

Staf dapat memilih **Buat akun baru** di bawah tombol **Masuk**, mengisi nama lengkap, divisi operasional, nama pengguna, dan kata sandi minimal sepuluh karakter. Setelah pendaftaran berhasil, masukkan kata sandi untuk masuk dengan akun baru.

Akun juga dapat dibuat melalui PowerShell 7. Jalankan sekali per akun dan masukkan kata sandi akun tersebut.

```powershell
$env:BAYNET_ACCOUNT_PASSWORD = Read-Host "Kata sandi akun baru" -MaskInput
npm.cmd run account:add -- --username staf-noc --name "Staf NOC" --division NOC
Remove-Item Env:BAYNET_ACCOUNT_PASSWORD
```

Untuk akun peninjau, contoh argumennya adalah `--username spv-noc --name "Supervisor NOC" --division Supervisor --review NOC,Helpdesk` dan `--username mgr-noc --name "Manajer Operasi" --division Manajer --review NOC,Helpdesk`. Pasangkan penugasan Supervisor dan Manajer untuk setiap divisi yang akan mengirim laporan. Akun demo dapat dibuat secara eksplisit pada database kosong dengan `npm.cmd run db:seed`.

Untuk menyalin data SQLite lokal, hentikan server lebih dahulu lalu salin folder `data` secara utuh, termasuk file pendamping SQLite jika ada. Lampiran tersimpan di database yang sama.

## Publikasi di Vercel

Proyek menggunakan Vite untuk antarmuka dan Vercel Functions untuk API Express. Pada proyek Supabase, buka **Connect → Transaction pooler** (port 6543). Isi kata sandi database pada URI tersebut dengan karakter khusus yang sudah di-URL-encode. Simpan URI sebagai variabel server **SUPABASE_DB_URL** di lingkungan **Production** pada Vercel. Backend memakai koneksi TLS dan membuat skema privat `baynet` pada akses pertama. Gunakan pengguna database yang memiliki izin membuat skema.

Jalankan `vercel deploy --prod` dari proyek yang sudah ditautkan. Uji `/api/meta`, pendaftaran staf, dan login melalui alamat HTTPS hasil publikasi. Proses ini memulai database kerja kosong. Pemindahan laporan lokal memerlukan migrasi data tersendiri. Untuk membuat akun Supervisor atau Manajer, jalankan `account:add` dengan `SUPABASE_DB_URL` di lingkungan terminal. Gunakan database terpisah untuk deployment Preview.

## Struktur proyek

```text
.
├── .env.example
├── .gitignore
├── README.md
├── index.html
├── package.json
├── package-lock.json
├── vite.config.js
├── public/
│   ├── baynet-icon.png
│   ├── baynet-logo.png
│   └── jaringan-baynet.jpg
├── scripts/
│   └── dev.mjs
├── src/
│   ├── main.jsx             # Rute dan sesi
│   ├── shared.jsx           # Konteks pengguna dan klien API
│   ├── Login.jsx
│   ├── Layout.jsx
│   ├── style.css
│   ├── dashboard/
│   │   ├── index.jsx        # Dasbor dan ringkasan
│   │   ├── NetworkArt.jsx
│   │   └── dashboard.css
│   └── reports/
│       ├── index.jsx
│       ├── common.jsx
│       ├── ReportList.jsx
│       ├── ReportForm.jsx
│       ├── ReportDetail.jsx
│       └── reports.css
└── server/
    ├── index.js             # HTTP, sesi, rute, penanganan kesalahan
    ├── config.js            # Divisi, shift, tanggal WIB, konfigurasi
    ├── db.js                # Migrasi skema dan transaksi SQLite
    ├── accounts.js          # Identitas, kata sandi dan sesi
    ├── account.js           # Pembuatan akun lokal
    ├── reports.js           # Otorisasi, alur laporan, lampiran, ringkasan
    ├── seed.js              # Data contoh
    ├── workflow.test.js     # Pengujian alur dan hak akses
    └── http.test.js         # Uji integrasi HTTP pada port lokal sementara
```

## Aktivasi akun pimpinan

Pendaftaran Manajer, Supervisor, dan Direktur menghasilkan pengajuan. Setelah memverifikasi identitas pendaftar, administrator menjalankan perintah berikut pada lingkungan yang terhubung ke database aplikasi. Ganti nama pengguna dan daftar divisi sesuai penugasan.

```powershell
npm.cmd run account:add -- --approve --username nama.pengguna --division Direktur
npm.cmd run account:add -- --approve --username nama.supervisor --division Supervisor --review "Helpdesk,NOC"
npm.cmd run account:add -- --approve --username nama.manajer --division Manajer --review "Helpdesk,NOC"
```

Direktur melihat hasil utama, kendala, dan tindak lanjut dari laporan pribadi Manajer dan Supervisor yang sudah dikirim, dengan filter tanggal dan shift. Draf dan laporan yang sedang direvisi dikecualikan.

## Pemeriksaan

Jalankan `npm.cmd test` untuk menguji alur bisnis pada database uji dan `npm.cmd run build` untuk memeriksa bundel frontend. API tersedia di bawah `/api`. Aplikasi mengirim JSON, menggunakan sesi melalui cookie HTTP-only, dan mengirim versi laporan saat menyimpan atau meninjau agar perubahan bersamaan terdeteksi. Unduhan lampiran diverifikasi melalui sesi pengguna.
