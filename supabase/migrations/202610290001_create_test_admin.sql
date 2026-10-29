-- Akun admin uji yang diminta untuk verifikasi tampilan admin.
update public.profiles
set role = 'admin'::public.user_role,
    requested_role = 'admin'::public.user_role,
    full_name = 'admin'
where nip = 'ADMIN001';
