-- Carrier GreenON Supabase 데이터베이스 설계
-- Supabase 프로젝트가 준비되면 SQL Editor에서 전체를 한 번 실행합니다.
-- 모든 사용자 데이터 테이블은 RLS와 명시적 권한을 함께 적용합니다.

begin;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default '그리너' check (char_length(display_name) between 1 and 30),
  green_points integer not null default 0 check (green_points >= 0),
  lifetime_points integer not null default 0 check (lifetime_points >= 0),
  green_level text not null default 'GREEN SPROUT'
    check (green_level in ('GREEN SPROUT', 'GREEN LEAF', 'GREEN TREE', 'GREEN FOREST')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.missions (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  title text not null,
  description text not null,
  reward_points integer not null check (reward_points > 0),
  target_minutes integer not null check (target_minutes > 0),
  min_temperature integer not null default 26 check (min_temperature between 18 and 30),
  required_mode text not null default 'COOL' check (required_mode in ('COOL', 'DRY', 'FAN')),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.user_missions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  mission_id uuid not null references public.missions (id) on delete restrict,
  mission_date date not null default ((timezone('Asia/Seoul', now()))::date),
  status text not null default 'active' check (status in ('active', 'completed', 'failed')),
  progress_minutes integer not null default 0 check (progress_minutes >= 0),
  reward_granted boolean not null default false,
  joined_at timestamptz not null default now(),
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (user_id, mission_id, mission_date)
);

create table if not exists public.point_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  transaction_type text not null check (transaction_type in ('earn', 'spend')),
  amount integer not null check (amount > 0),
  description text not null,
  reference_type text not null check (reference_type in ('mission', 'reward_order')),
  reference_id uuid not null,
  created_at timestamptz not null default now(),
  unique (user_id, transaction_type, reference_type, reference_id)
);

create table if not exists public.rewards (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  category text not null check (category in ('FOOD', 'LIFE', 'CARRIER')),
  name text not null,
  description text not null,
  points_price integer not null check (points_price > 0),
  icon text not null default '🎁',
  stock integer check (stock is null or stock >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.reward_orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  reward_id uuid not null references public.rewards (id) on delete restrict,
  product_name text not null,
  points_spent integer not null check (points_spent > 0),
  status text not null default 'completed' check (status in ('completed', 'cancelled')),
  created_at timestamptz not null default now()
);

create table if not exists public.aircon_status (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  power boolean not null default true,
  mode text not null default 'COOL' check (mode in ('COOL', 'DRY', 'FAN')),
  temperature integer not null default 26 check (temperature between 18 and 30),
  fan text not null default 'AUTO' check (fan in ('AUTO', 'LOW', 'MID', 'HIGH')),
  usage_minutes integer not null default 0 check (usage_minutes >= 0),
  filter_percent integer not null default 82 check (filter_percent between 0 and 100),
  sensor_status text not null default 'normal' check (sensor_status in ('normal', 'error')),
  updated_at timestamptz not null default now()
);

create index if not exists user_missions_user_date_idx
  on public.user_missions (user_id, mission_date desc);
create index if not exists user_missions_mission_id_idx
  on public.user_missions (mission_id);
create index if not exists point_transactions_user_created_idx
  on public.point_transactions (user_id, created_at desc);
create index if not exists reward_orders_user_created_idx
  on public.reward_orders (user_id, created_at desc);
create index if not exists reward_orders_reward_id_idx
  on public.reward_orders (reward_id);

-- 새 Auth 사용자의 프로필과 가상 에어컨 상태를 자동 생성합니다.
-- user_metadata의 표시 이름은 화면 표시용이며 권한 판단에는 사용하지 않습니다.
create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''), '그리너')
  )
  on conflict (id) do nothing;

  insert into public.aircon_status (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

revoke all on function private.handle_new_user() from public, anon, authenticated;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke all on function private.set_updated_at() from public, anon, authenticated;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function private.set_updated_at();

drop trigger if exists user_missions_set_updated_at on public.user_missions;
create trigger user_missions_set_updated_at
  before update on public.user_missions
  for each row execute function private.set_updated_at();

drop trigger if exists rewards_set_updated_at on public.rewards;
create trigger rewards_set_updated_at
  before update on public.rewards
  for each row execute function private.set_updated_at();

drop trigger if exists aircon_status_set_updated_at on public.aircon_status;
create trigger aircon_status_set_updated_at
  before update on public.aircon_status
  for each row execute function private.set_updated_at();

-- 사용자가 진행률을 정확히 30분 올릴 때 조건 판정과 포인트 지급을 처리합니다.
-- 트리거 함수는 Data API에 노출되지 않는 private 스키마에 둡니다.
create or replace function private.process_mission_progress()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_mission public.missions%rowtype;
  v_aircon public.aircon_status%rowtype;
begin
  if v_user_id is null or new.user_id <> v_user_id then
    raise exception 'AUTH_REQUIRED' using errcode = 'P0001';
  end if;

  if old.status <> 'active' then
    raise exception 'MISSION_NOT_ACTIVE' using errcode = 'P0001';
  end if;

  if new.progress_minutes <> old.progress_minutes + 30 then
    raise exception 'INVALID_SIMULATION_STEP' using errcode = 'P0001';
  end if;

  select * into v_mission
  from public.missions
  where id = old.mission_id and active is true;

  if not found then
    raise exception 'MISSION_NOT_FOUND' using errcode = 'P0001';
  end if;

  select * into v_aircon
  from public.aircon_status
  where user_id = v_user_id
  for update;

  if not found then
    raise exception 'AIRCON_STATUS_NOT_FOUND' using errcode = 'P0001';
  end if;

  if v_aircon.power is not true
    or v_aircon.mode <> v_mission.required_mode
    or v_aircon.temperature < v_mission.min_temperature
    or v_aircon.sensor_status <> 'normal' then
    new.status := 'failed';
    new.progress_minutes := old.progress_minutes;
    return new;
  end if;

  update public.aircon_status
  set usage_minutes = usage_minutes + 30
  where user_id = v_user_id;

  new.progress_minutes := least(new.progress_minutes, v_mission.target_minutes);

  if new.progress_minutes >= v_mission.target_minutes then
    new.status := 'completed';
    new.completed_at := now();
    new.reward_granted := true;

    if old.reward_granted is false then
      update public.profiles
      set
        green_points = green_points + v_mission.reward_points,
        lifetime_points = lifetime_points + v_mission.reward_points,
        green_level = case
          when lifetime_points + v_mission.reward_points >= 3000 then 'GREEN FOREST'
          when lifetime_points + v_mission.reward_points >= 1500 then 'GREEN TREE'
          when lifetime_points + v_mission.reward_points >= 500 then 'GREEN LEAF'
          else 'GREEN SPROUT'
        end
      where id = v_user_id;

      insert into public.point_transactions (
        user_id,
        transaction_type,
        amount,
        description,
        reference_type,
        reference_id
      ) values (
        v_user_id,
        'earn',
        v_mission.reward_points,
        v_mission.title,
        'mission',
        old.id
      )
      on conflict (user_id, transaction_type, reference_type, reference_id) do nothing;
    end if;
  end if;

  return new;
end;
$$;

revoke all on function private.process_mission_progress() from public, anon, authenticated;

drop trigger if exists user_missions_process_progress on public.user_missions;
create trigger user_missions_process_progress
  before update of progress_minutes on public.user_missions
  for each row execute function private.process_mission_progress();

-- 주문 행을 만들 때 포인트 확인, 차감, 거래 기록을 원자적으로 처리합니다.
create or replace function private.process_reward_order()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_reward public.rewards%rowtype;
  v_balance integer;
begin
  if v_user_id is null or new.user_id <> v_user_id then
    raise exception 'AUTH_REQUIRED' using errcode = 'P0001';
  end if;

  select * into v_reward
  from public.rewards
  where id = new.reward_id and active is true
  for update;

  if not found then
    raise exception 'REWARD_NOT_FOUND' using errcode = 'P0001';
  end if;

  if v_reward.stock is not null and v_reward.stock <= 0 then
    raise exception 'OUT_OF_STOCK' using errcode = 'P0001';
  end if;

  select green_points into v_balance
  from public.profiles
  where id = v_user_id
  for update;

  if v_balance < v_reward.points_price then
    raise exception 'INSUFFICIENT_POINTS' using errcode = 'P0001';
  end if;

  update public.profiles
  set green_points = green_points - v_reward.points_price
  where id = v_user_id
  returning green_points into v_balance;

  new.product_name := v_reward.name;
  new.points_spent := v_reward.points_price;
  new.status := 'completed';

  insert into public.point_transactions (
    user_id,
    transaction_type,
    amount,
    description,
    reference_type,
    reference_id
  ) values (
    v_user_id,
    'spend',
    v_reward.points_price,
    v_reward.name,
    'reward_order',
    new.id
  );

  if v_reward.stock is not null then
    update public.rewards set stock = stock - 1 where id = v_reward.id;
  end if;

  return new;
end;
$$;

revoke all on function private.process_reward_order() from public, anon, authenticated;

drop trigger if exists reward_orders_process_purchase on public.reward_orders;
create trigger reward_orders_process_purchase
  before insert on public.reward_orders
  for each row execute function private.process_reward_order();

-- 모든 Data API 노출 테이블에 RLS를 활성화합니다.
alter table public.profiles enable row level security;
alter table public.missions enable row level security;
alter table public.user_missions enable row level security;
alter table public.point_transactions enable row level security;
alter table public.rewards enable row level security;
alter table public.reward_orders enable row level security;
alter table public.aircon_status enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select to authenticated
  using ((select auth.uid()) = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

drop policy if exists "missions_read_active" on public.missions;
create policy "missions_read_active" on public.missions
  for select to anon, authenticated
  using (active is true);

drop policy if exists "user_missions_select_own" on public.user_missions;
create policy "user_missions_select_own" on public.user_missions
  for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "user_missions_insert_own" on public.user_missions;
create policy "user_missions_insert_own" on public.user_missions
  for insert to authenticated
  with check ((select auth.uid()) = user_id and status = 'active' and progress_minutes = 0);

drop policy if exists "user_missions_update_progress_own" on public.user_missions;
create policy "user_missions_update_progress_own" on public.user_missions
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "point_transactions_select_own" on public.point_transactions;
create policy "point_transactions_select_own" on public.point_transactions
  for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "rewards_read_active" on public.rewards;
create policy "rewards_read_active" on public.rewards
  for select to anon, authenticated
  using (active is true);

drop policy if exists "reward_orders_select_own" on public.reward_orders;
create policy "reward_orders_select_own" on public.reward_orders
  for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "reward_orders_insert_own" on public.reward_orders;
create policy "reward_orders_insert_own" on public.reward_orders
  for insert to authenticated
  with check ((select auth.uid()) = user_id and status = 'completed');

drop policy if exists "aircon_status_select_own" on public.aircon_status;
create policy "aircon_status_select_own" on public.aircon_status
  for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "aircon_status_insert_own" on public.aircon_status;
create policy "aircon_status_insert_own" on public.aircon_status
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "aircon_status_update_own" on public.aircon_status;
create policy "aircon_status_update_own" on public.aircon_status
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- 2026 Data API 기본 변경에 대비해 테이블 권한을 최소 범위로 명시합니다.
revoke all on public.profiles from anon, authenticated;
revoke all on public.missions from anon, authenticated;
revoke all on public.user_missions from anon, authenticated;
revoke all on public.point_transactions from anon, authenticated;
revoke all on public.rewards from anon, authenticated;
revoke all on public.reward_orders from anon, authenticated;
revoke all on public.aircon_status from anon, authenticated;

revoke create on schema public from public;
grant usage on schema public to anon, authenticated;
grant select on public.missions, public.rewards to anon, authenticated;
grant select on public.profiles to authenticated;
grant update (display_name) on public.profiles to authenticated;
grant select on public.user_missions to authenticated;
grant insert (user_id, mission_id) on public.user_missions to authenticated;
grant update (progress_minutes) on public.user_missions to authenticated;
grant select on public.point_transactions to authenticated;
grant select on public.reward_orders to authenticated;
grant insert (user_id, reward_id) on public.reward_orders to authenticated;
grant select, insert, update on public.aircon_status to authenticated;

-- 교육용 기본 미션과 리워드 상품입니다.
insert into public.missions (
  id, code, title, description, reward_points, target_minutes, min_temperature, required_mode
) values (
  '10000000-0000-4000-8000-000000000001',
  'healthy-cooling-26',
  '26°C 건강 냉방',
  '에어컨을 26°C 이상 COOL 모드로 설정하고 120분 동안 유지해 주세요.',
  300,
  120,
  26,
  'COOL'
)
on conflict (code) do update set
  title = excluded.title,
  description = excluded.description,
  reward_points = excluded.reward_points,
  target_minutes = excluded.target_minutes,
  min_temperature = excluded.min_temperature,
  required_mode = excluded.required_mode,
  active = true;

insert into public.rewards (id, code, category, name, description, points_price, icon)
values
  ('20000000-0000-4000-8000-000000000001', 'food-coffee', 'FOOD', '그린 아이스 아메리카노', '시원한 아이스 아메리카노 모바일 쿠폰이에요.', 250, '☕'),
  ('20000000-0000-4000-8000-000000000002', 'food-salad', 'FOOD', '싱그러운 샐러드 한 끼', '가볍고 건강한 샐러드 교환권이에요.', 600, '🥗'),
  ('20000000-0000-4000-8000-000000000003', 'life-detergent', 'LIFE', '친환경 세탁세제', '환경 부담을 줄인 리필형 세탁세제 쿠폰이에요.', 900, '🫧'),
  ('20000000-0000-4000-8000-000000000004', 'life-tumbler', 'LIFE', 'GreenON 텀블러', '일회용 컵 사용을 줄여 주는 블루 텀블러예요.', 1200, '🥤'),
  ('20000000-0000-4000-8000-000000000005', 'carrier-filter', 'CARRIER', '에어컨 필터 할인 쿠폰', '캐리어 에어컨 필터 할인 쿠폰이에요.', 300, '❄️'),
  ('20000000-0000-4000-8000-000000000006', 'carrier-care', 'CARRIER', '에어컨 방문 점검 할인', '전문 엔지니어의 방문 점검 할인 쿠폰이에요.', 1500, '🧰')
on conflict (code) do update set
  category = excluded.category,
  name = excluded.name,
  description = excluded.description,
  points_price = excluded.points_price,
  icon = excluded.icon,
  active = true;

commit;
