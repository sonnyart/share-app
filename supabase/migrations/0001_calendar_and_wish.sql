-- Share App — Supabase 마이그레이션
-- Supabase 대시보드 > SQL Editor 에서 이 파일 전체를 실행하세요.
-- (photos 테이블과 photos 스토리지 버킷은 이미 생성되어 있다고 가정합니다.)

-- 1) 캘린더(일정/기념일) 테이블
create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  type text not null default 'schedule' check (type in ('schedule', 'anniversary')),
  date date not null,
  created_at timestamptz not null default now()
);

-- 2) 위시 리스트 테이블
create table if not exists public.wishes (
  id uuid primary key default gen_random_uuid(),
  text text not null,
  done boolean not null default false,
  created_at timestamptz not null default now()
);

-- 3) 조회 성능을 위한 인덱스
create index if not exists events_date_idx on public.events (date);
create index if not exists wishes_created_at_idx on public.wishes (created_at);

-- ============================================================
-- 참고: 이 앱은 로그인 없이 anon(publishable) 키를 사용합니다.
-- 따라서 위 테이블들은 RLS(Row Level Security)가 비활성화된 상태로
-- 동작해야 합니다. 나중에 계정 인증을 붙이려면 아래처럼 RLS를 켜고
-- 정책(policy)을 추가하세요.
--
--   alter table public.events enable row level security;
--   alter table public.wishes enable row level security;
--   create policy "allow all" on public.events for all using (true);
--   create policy "allow all" on public.wishes for all using (true);
-- ============================================================
