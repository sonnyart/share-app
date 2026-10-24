-- Share App — 사진 그룹(한 페이지에 여러 장) 기능용 마이그레이션
-- Supabase 대시보드 → SQL Editor 에서 실행하세요.

-- 1) 사진 테이블에 그룹 ID 컬럼 추가 (같은 업로드 배치는 같은 group_id 공유)
alter table public.photos add column if not exists group_id uuid;

-- 2) 그룹 조회용 인덱스
create index if not exists photos_group_id_idx on public.photos (group_id);
