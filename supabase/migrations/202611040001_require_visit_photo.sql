-- Dokumentasi baru wajib memiliki referensi foto. NOT VALID menjaga data lama
-- yang mungkin belum memiliki foto, tetapi tetap memvalidasi semua data baru.
alter table public.visits
  add constraint visits_photo_path_required
  check (nullif(btrim(photo_path), '') is not null) not valid;
