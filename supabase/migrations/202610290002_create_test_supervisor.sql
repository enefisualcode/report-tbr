-- Akun TBR Supervisor uji yang diminta untuk verifikasi tampilan supervisor.
update public.profiles
set role = 'supervisor'::public.user_role,
    requested_role = 'supervisor'::public.user_role,
    full_name = 'TBR SPV'
where nip = 'SPV001';
