# TBR Performance

Dashboard multi-staff untuk mencatat closing, dokumentasi kunjungan, riwayat, ranking, dan monitoring supervisor. Autentikasi, database, pembatasan akses, serta penyimpanan foto menggunakan Supabase.

## 1. Siapkan Supabase

1. Buat project di Supabase.
2. Buka **SQL Editor**, lalu jalankan file di `supabase/migrations` secara berurutan. Untuk database yang sudah menjalankan migration awal, cukup jalankan `202610260002_nip_auth.sql`.
3. Buka **Authentication → Sign In / Providers → Email** dan nonaktifkan **Confirm email**. Aplikasi memakai NIP sebagai identitas login teknis sehingga tidak mengirim email konfirmasi.
4. Staff dapat mendaftar melalui tab **Sign Up** menggunakan nama lengkap, NIP, password, dan jabatan. Setelah menjalankan migration `202610260005_full_name.sql`, nama lengkap akan tersimpan di profile.
5. Tetapkan akun developer sebagai admin melalui SQL Editor setelah akun tersebut mendaftar:

```sql
update public.profiles set role = 'admin' where nip = 'NIP_ADMIN';
```

   Jalankan migration `202610270001_admin_role.sql` dan `202610270002_admin_access.sql` terlebih dahulu. Admin login dengan NIP dan password lalu membuka menu **Approval SPV**. Pendaftar yang memilih Supervisor tetap menjadi Staff sampai admin menyetujui permintaannya. Staff tidak memerlukan persetujuan untuk menggunakan aplikasi. Akun yang sudah disetujui perlu masuk ulang untuk memuat role terbaru.

6. Ambil **Project URL** dan **Publishable key** dari **Project Settings → API**, lalu isi `config.js`. Publishable key aman digunakan di frontend; jangan pernah memasukkan secret/service-role key ke file ini.

```js
window.TBR_CONFIG = {
  supabaseUrl: 'https://PROJECT_ID.supabase.co',
  supabasePublishableKey: 'sb_publishable_...'
};
```

## 2. Jalankan

```bash
npm run build
npm start
```

Buka `http://localhost:4173`. Setelah mengubah source, jalankan kembali `npm run build` agar folder `dist` diperbarui untuk deployment GitHub Pages.

## Pemeriksaan

```bash
npm run check
```

## Struktur data dan keamanan

- `profiles`: nama, area, dan role staff/supervisor.
- `closings`: laporan closing per pengguna.
- `visits`: kunjungan dan referensi foto.
- bucket private `visit-photos`: foto diakses menggunakan URL sementara.
- Migration `202610260006_visit_photo_storage.sql` memastikan bucket foto, batas 5 MB, dan policy upload/read/delete tersedia.
- bucket private `profile-photos`: foto profil staff diakses menggunakan URL sementara.
- Migration `202610260007_profile_photo.sql` menambahkan kolom foto profil, bucket, policy, dan fungsi pembaruan profil.
- Migration `202610260008_leaderboard_avatars.sql` menampilkan foto profil pada ranking untuk pengguna yang sudah login.
- Dashboard SPV menampilkan rincian closing yang dapat difilter berdasarkan bulan, staff, dan produk.
- Row Level Security: staff hanya membaca/mengubah laporannya sendiri; supervisor dapat membaca laporan seluruh tim.
- Ranking bulanan tersedia untuk seluruh pengguna melalui fungsi database yang hanya mengembalikan nama dan total.

Untuk revisi skema berikutnya, tambahkan file migration baru di `supabase/migrations` dan jangan mengubah migration yang sudah diterapkan pada database produksi.

