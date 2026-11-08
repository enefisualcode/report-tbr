# TBR Performance

Dashboard Vanilla JavaScript untuk pencatatan closing, dokumentasi kunjungan, ranking staf, monitoring supervisor, KPI, dan administrasi pengguna. Supabase tetap menjadi backend untuk autentikasi, PostgreSQL, RPC, Row Level Security, dan penyimpanan foto.

## Menjalankan aplikasi

1. Isi `config.js` dengan Project URL dan publishable key Supabase. Jangan gunakan service-role key di frontend.
2. Build source ke folder `dist`.
3. Jalankan server statis lokal.

```bash
npm run build
npm start
```

Buka `http://127.0.0.1:4173`. Perintah `npm run dev` menjalankan server yang sama. Setiap perubahan source perlu diikuti `npm run build` karena server melayani isi `dist`.

## Pemeriksaan

```bash
npm run check
npm test
npm run build
```

- `npm run check` memeriksa sintaks seluruh JavaScript dan memastikan aset lokal yang dirujuk `index.html` tersedia.
- `npm test` menjalankan pengujian ringan untuk utilitas tanggal, normalisasi closing, filter riwayat, escape HTML, dan total produk.
- `npm run build` membersihkan lalu menghasilkan ulang `dist` dari source yang terdaftar di `build.js`.

## Struktur source

```text
report-tbr/
├── index.html
├── styles.css
├── config.js
├── server.js
├── build.js
├── package.json
├── assets/
├── js/
│   ├── main.js                    # bootstrap, routing, dan event controller
│   ├── core/
│   │   └── core.js                # konstanta, state, dan fungsi murni
│   ├── services/
│   │   └── services.js            # Supabase, storage, RPC, dan ekspor
│   ├── views/
│   │   └── views.js               # rendering halaman dan komponen
│   └── pages/
│       ├── admin.js               # perilaku panel Admin
│       └── kpi-supervisor.js      # perhitungan dan tampilan KPI Supervisor
├── scripts/
│   └── check.js
├── tests/
│   └── core.test.js
└── supabase/
    └── migrations/
```

Modul browser menggunakan satu namespace `window.TBR` untuk menghindari kumpulan variabel global terpisah. Urutan script di `index.html` penting: core, services, views, page modules, lalu main.

## Batas tanggung jawab

- `core.js`: katalog produk, metadata halaman, state aplikasi, pemformatan tanggal, normalisasi data, perhitungan periode, dan filter murni.
- `services.js`: satu-satunya tempat akses Supabase, bucket Storage, RPC, serta pembuatan file Excel.
- `views.js`: mengubah state menjadi DOM tanpa menjalankan query database.
- `admin.js` dan `kpi-supervisor.js`: logika khusus halaman yang tidak membebani controller utama.
- `main.js`: menghubungkan form, event, routing, session, services, dan views.

## Supabase

Jalankan migration dalam `supabase/migrations` secara berurutan untuk project baru. Migration yang sudah diterapkan tidak boleh diedit; perubahan skema berikutnya harus dibuat sebagai migration baru.

Data utama:

- `profiles`: nama, NIP, area, role, dan referensi foto profil.
- `closings`: closing per pengguna dan tanggal.
- `visits`: dokumentasi kunjungan dan referensi foto.
- bucket `visit-photos` dan `profile-photos`: penyimpanan foto private sesuai policy yang tersedia.

Autentikasi tetap memakai NIP yang dipetakan ke email internal untuk Supabase Auth. Role Staff, Supervisor, dan Admin serta seluruh RLS/RPC mengikuti migration yang sudah ada.

## Build dan deployment

`build.js` adalah manifest source deployment. Jika modul atau aset lokal baru ditambahkan ke `index.html`, tambahkan juga file tersebut ke manifest `assets` di `build.js`. Jangan mengedit `dist` secara manual.
