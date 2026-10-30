create schema if not exists private;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null check (username ~ '^[a-z0-9_]{3,24}$'),
  display_name text not null default '' check (char_length(display_name) <= 50),
  bio text not null default '' check (char_length(bio) <= 300),
  avatar_url text,
  communities text[] not null default '{}' check (communities <@ array['veterans','travel','appalachia','philippines']),
  is_admin boolean not null default false,
  is_demo boolean not null default false,
  age_confirmed_at timestamptz,
  terms_accepted_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.videos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  video_path text not null,
  poster_path text,
  caption text not null default '' check (char_length(caption) <= 300),
  hashtags text[] not null default '{}',
  duration_s numeric check (duration_s is null or duration_s <= 61),
  status text not null default 'active' check (status in ('active','removed')),
  is_demo boolean not null default false,
  created_at timestamptz not null default now()
);
create index on public.videos (user_id);
create index on public.videos (created_at desc);

create table public.likes (
  user_id uuid not null references public.profiles(id) on delete cascade,
  video_id uuid not null references public.videos(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, video_id)
);
create index on public.likes (video_id);

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  video_id uuid not null references public.videos(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 500),
  created_at timestamptz not null default now()
);
create index on public.comments (video_id);
create index on public.comments (user_id);

create table public.follows (
  follower_id uuid not null references public.profiles(id) on delete cascade,
  following_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, following_id),
  check (follower_id <> following_id)
);
create index on public.follows (following_id);

create table public.blocks (
  blocker_id uuid not null references public.profiles(id) on delete cascade,
  blocked_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);
create index on public.blocks (blocked_id);

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  video_id uuid not null references public.videos(id) on delete cascade,
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  rule text not null,
  details text not null default '' check (char_length(details) <= 500),
  status text not null default 'open' check (status in ('open','actioned','dismissed')),
  created_at timestamptz not null default now()
);
create index on public.reports (video_id);
create index on public.reports (reporter_id);

create table public.takedowns (
  id uuid primary key default gen_random_uuid(),
  video_id uuid not null references public.videos(id) on delete cascade,
  creator_id uuid not null references public.profiles(id) on delete cascade,
  admin_id uuid references public.profiles(id) on delete set null,
  rule text not null,
  reason text not null,
  appeal_text text,
  appeal_status text not null default 'none' check (appeal_status in ('none','pending','upheld','restored')),
  appeal_response text,
  created_at timestamptz not null default now(),
  appealed_at timestamptz
);
create index on public.takedowns (video_id);
create index on public.takedowns (creator_id);
create index on public.takedowns (admin_id);

-- helpers
create or replace function private.is_admin() returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((select is_admin from public.profiles where id = (select auth.uid())), false)
$$;
grant usage on schema private to authenticated, anon;
grant execute on function private.is_admin() to authenticated, anon;

alter table public.profiles enable row level security;
alter table public.videos enable row level security;
alter table public.likes enable row level security;
alter table public.comments enable row level security;
alter table public.follows enable row level security;
alter table public.blocks enable row level security;
alter table public.reports enable row level security;
alter table public.takedowns enable row level security;

-- profiles: public read, owner update of safe columns only
create policy profiles_read on public.profiles for select using (true);
create policy profiles_update_own on public.profiles for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));
revoke update on public.profiles from authenticated, anon;
grant update (display_name, bio, avatar_url, communities) on public.profiles to authenticated;
revoke insert, delete on public.profiles from authenticated, anon;

-- videos
create policy videos_read on public.videos for select using (status = 'active' or user_id = (select auth.uid()) or (select private.is_admin()));
create policy videos_insert_own on public.videos for insert to authenticated with check (user_id = (select auth.uid()) and status = 'active' and is_demo = false);
create policy videos_update_own on public.videos for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy videos_delete_own on public.videos for delete to authenticated using (user_id = (select auth.uid()));
revoke update on public.videos from authenticated, anon;
grant update (caption, hashtags) on public.videos to authenticated;

-- likes
create policy likes_read on public.likes for select using (true);
create policy likes_insert_own on public.likes for insert to authenticated with check (user_id = (select auth.uid()));
create policy likes_delete_own on public.likes for delete to authenticated using (user_id = (select auth.uid()));

-- comments
create policy comments_read on public.comments for select using (exists (select 1 from public.videos v where v.id = video_id));
create policy comments_insert_own on public.comments for insert to authenticated with check (user_id = (select auth.uid()));
create policy comments_delete_own on public.comments for delete to authenticated using (user_id = (select auth.uid()));

-- follows
create policy follows_read on public.follows for select using (true);
create policy follows_insert_own on public.follows for insert to authenticated with check (follower_id = (select auth.uid()));
create policy follows_delete_own on public.follows for delete to authenticated using (follower_id = (select auth.uid()));

-- blocks (private to blocker)
create policy blocks_read_own on public.blocks for select to authenticated using (blocker_id = (select auth.uid()));
create policy blocks_insert_own on public.blocks for insert to authenticated with check (blocker_id = (select auth.uid()));
create policy blocks_delete_own on public.blocks for delete to authenticated using (blocker_id = (select auth.uid()));

-- reports
create policy reports_read on public.reports for select to authenticated using (reporter_id = (select auth.uid()) or (select private.is_admin()));
create policy reports_insert_own on public.reports for insert to authenticated with check (reporter_id = (select auth.uid()) and status = 'open');

-- takedowns: read by creator/admin; writes via RPC only
create policy takedowns_read on public.takedowns for select to authenticated using (creator_id = (select auth.uid()) or (select private.is_admin()));

-- RPCs
create or replace function public.take_down(p_video uuid, p_rule text, p_reason text) returns uuid language plpgsql security definer set search_path = '' as $$
declare v_creator uuid; v_id uuid;
begin
  if not private.is_admin() then raise exception 'admins only'; end if;
  if coalesce(trim(p_rule),'') = '' or coalesce(trim(p_reason),'') = '' then raise exception 'rule and reason are required'; end if;
  select user_id into v_creator from public.videos where id = p_video;
  if v_creator is null then raise exception 'clip not found'; end if;
  update public.videos set status = 'removed' where id = p_video;
  insert into public.takedowns (video_id, creator_id, admin_id, rule, reason) values (p_video, v_creator, auth.uid(), p_rule, p_reason) returning id into v_id;
  update public.reports set status = 'actioned' where video_id = p_video and status = 'open';
  return v_id;
end $$;

create or replace function public.dismiss_reports(p_video uuid) returns void language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_admin() then raise exception 'admins only'; end if;
  update public.reports set status = 'dismissed' where video_id = p_video and status = 'open';
end $$;

create or replace function public.submit_appeal(p_takedown uuid, p_text text) returns void language plpgsql security definer set search_path = '' as $$
begin
  if coalesce(trim(p_text),'') = '' then raise exception 'please say why'; end if;
  update public.takedowns set appeal_text = left(p_text, 1000), appeal_status = 'pending', appealed_at = now()
   where id = p_takedown and creator_id = auth.uid() and appeal_status = 'none';
  if not found then raise exception 'appeal not allowed'; end if;
end $$;

create or replace function public.decide_appeal(p_takedown uuid, p_restore boolean, p_response text) returns void language plpgsql security definer set search_path = '' as $$
declare v_video uuid;
begin
  if not private.is_admin() then raise exception 'admins only'; end if;
  update public.takedowns set appeal_status = case when p_restore then 'restored' else 'upheld' end, appeal_response = p_response
   where id = p_takedown and appeal_status = 'pending' returning video_id into v_video;
  if v_video is null then raise exception 'no pending appeal'; end if;
  if p_restore then update public.videos set status = 'active' where id = v_video; end if;
end $$;

revoke execute on function public.take_down(uuid,text,text), public.dismiss_reports(uuid), public.submit_appeal(uuid,text), public.decide_appeal(uuid,boolean,text) from public, anon;
grant execute on function public.take_down(uuid,text,text), public.dismiss_reports(uuid), public.submit_appeal(uuid,text), public.decide_appeal(uuid,boolean,text) to authenticated;

-- profile auto-create from signup metadata
create or replace function private.handle_new_user() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, username, display_name, age_confirmed_at, terms_accepted_at)
  values (new.id,
    coalesce(new.raw_user_meta_data->>'username', 'user_' || substr(replace(new.id::text,'-',''),1,10)),
    coalesce(new.raw_user_meta_data->>'display_name', ''),
    case when (new.raw_user_meta_data->>'age_18') = 'true' then now() end,
    case when (new.raw_user_meta_data->>'terms') = 'true' then now() end);
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function private.handle_new_user();

-- storage
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('clips','clips', true, 26214400, array['video/mp4','video/webm','video/quicktime','image/jpeg','image/png','image/webp']);
create policy clips_insert_own on storage.objects for insert to authenticated with check (bucket_id = 'clips' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy clips_delete_own on storage.objects for delete to authenticated using (bucket_id = 'clips' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy clips_update_own on storage.objects for update to authenticated using (bucket_id = 'clips' and (storage.foldername(name))[1] = (select auth.uid())::text);

