insert into public.profiles (id, email, full_name, role)
select u.id, u.email,
  coalesce(u.raw_user_meta_data->>'full_name', split_part(u.email,'@',1)),
  case when lower(u.email) in ('umidbekramanov0427@gmail.com','super@admin.com')
       then 'super_admin'::public.app_role else 'rep'::public.app_role end
from auth.users u
where u.email is not null
on conflict (id) do nothing;