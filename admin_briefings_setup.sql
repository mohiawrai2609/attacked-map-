-- ─────────────────────────────────────────────────────────────────────────
-- admin_briefings_setup.sql
--
-- One-time setup so the admin "Briefings" tab can attach a custom news image
-- and a full article body to any incident shown on the Attacked Hub.
--
-- Run this ONCE in the Supabase SQL editor (Dashboard → SQL → New query →
-- paste → Run). Safe to re-run: every statement is idempotent.
-- ─────────────────────────────────────────────────────────────────────────

-- 1. New columns on both incident tables ----------------------------------
alter table public.incidents     add column if not exists image_url    text;
alter table public.incidents     add column if not exists article_body text;
alter table public.vi_incidents  add column if not exists image_url    text;
alter table public.vi_incidents  add column if not exists article_body text;

-- 2. Admin-only RPC to write the media ------------------------------------
--    Mirrors the existing admin_* functions: security definer + _is_admin()
--    gate so only the internal team can call it (anon/free users cannot).
create or replace function public.admin_set_incident_media(
  p_source       text,
  p_incident_id  bigint,
  p_image_url    text,
  p_article_body text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not _is_admin() then
    raise exception 'not authorised';
  end if;

  if p_source = 'vi' then
    update public.vi_incidents
       set image_url    = nullif(btrim(p_image_url), ''),
           article_body = nullif(btrim(p_article_body), '')
     where id = p_incident_id;
  else
    update public.incidents
       set image_url    = nullif(btrim(p_image_url), ''),
           article_body = nullif(btrim(p_article_body), '')
     where id = p_incident_id;
  end if;
end;
$$;

grant execute on function public.admin_set_incident_media(text, bigint, text, text)
  to authenticated;

-- 3. Public storage bucket for uploaded images ----------------------------
insert into storage.buckets (id, name, public)
values ('incident-media', 'incident-media', true)
on conflict (id) do update set public = true;

-- Anyone can read the images (they appear on the public hub).
drop policy if exists "incident-media public read" on storage.objects;
create policy "incident-media public read"
  on storage.objects for select
  using (bucket_id = 'incident-media');

-- Only admins can upload / overwrite / delete.
drop policy if exists "incident-media admin insert" on storage.objects;
create policy "incident-media admin insert"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'incident-media' and _is_admin());

drop policy if exists "incident-media admin update" on storage.objects;
create policy "incident-media admin update"
  on storage.objects for update to authenticated
  using (bucket_id = 'incident-media' and _is_admin());

drop policy if exists "incident-media admin delete" on storage.objects;
create policy "incident-media admin delete"
  on storage.objects for delete to authenticated
  using (bucket_id = 'incident-media' and _is_admin());
