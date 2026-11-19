-- Rituál – databázové schéma pro Supabase
-- Spusť celé v Supabase: SQL Editor → New query → vlož → Run.
-- Každá tabulka má Row Level Security: uživatel vidí a mění jen svoje řádky.

-- Profil (1 řádek na uživatele)
create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- Produkty
create table if not exists public.products (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  data jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

-- Deník (1 řádek na den)
create table if not exists public.days (
  user_id uuid not null references auth.users(id) on delete cascade,
  date text not null,
  data jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, date)
);

-- Kosmetické procedury
create table if not exists public.treatments (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  data jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

-- Počítadlo AI dotazů (denní limit). Přístup jen přes server.
create table if not exists public.ai_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null,
  count int not null default 0,
  primary key (user_id, day)
);

-- Row Level Security
alter table public.profiles   enable row level security;
alter table public.products   enable row level security;
alter table public.days       enable row level security;
alter table public.treatments enable row level security;
alter table public.ai_usage   enable row level security;  -- bez politik = nikdo z prohlížeče

drop policy if exists "own profile" on public.profiles;
create policy "own profile" on public.profiles
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own products" on public.products;
create policy "own products" on public.products
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own days" on public.days;
create policy "own days" on public.days
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own treatments" on public.treatments;
create policy "own treatments" on public.treatments
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Atomické započítání AI dotazu s limitem. Vrací true = povoleno, false = limit vyčerpán.
create or replace function public.ai_use(p_user uuid, p_day date, p_limit int)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare c int;
begin
  insert into ai_usage(user_id, day, count) values (p_user, p_day, 1)
  on conflict (user_id, day) do update set count = ai_usage.count + 1
  returning count into c;
  if c > p_limit then
    update ai_usage set count = count - 1 where user_id = p_user and day = p_day;
    return false;
  end if;
  return true;
end $$;

revoke execute on function public.ai_use(uuid, date, int) from public, anon, authenticated;
