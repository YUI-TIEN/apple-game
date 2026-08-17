-- =====================================================================
-- apple-game 團體戰 — 資料庫 schema、正規化、RLS 政策
-- 對應 GitHub issue #4（資料層）／issue #1（賽制決策）／issue #3（前端防呆需求）
--
-- 用法：整份貼進 Supabase SQL Editor 執行即可。
-- 幂等設計：可以重複執行不出錯（IF NOT EXISTS / OR REPLACE / DROP ... IF EXISTS）。
--
-- 已在真實 Supabase 專案執行並以 anon / publishable key 驗證：RLS、
-- 鎖房、隊名正規化、唯一約束、併發寫入與 Realtime INSERT 均可運作。
-- =====================================================================


-- =====================================================================
-- 1. 資料表
-- =====================================================================

-- rooms：一場活動一個房間。
create table if not exists public.rooms (
  code       text primary key
             check (code ~ '^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{4}$'),
  title      text,
  locked     boolean not null default false,
  created_at timestamptz not null default now()
);

comment on table public.rooms is
  '一場活動一個房間。code 是 4 碼房號（大寫英數，排除 0 O 1 I L 避免現場口頭念錯），由前端 src/net/rooms.js 產生。';
comment on column public.rooms.locked is
  '鎖房後拒收新成績，這是這版唯一的防護措施（見 issue #3）。UPDATE 只允許改這個欄位，見下方 grant。';

-- scores：每隊一局的成績。一隊一筆、以第一筆為準，成績送出後不可 update / delete。
create table if not exists public.scores (
  id         bigint generated always as identity primary key,
  room_code  text not null references public.rooms (code) on delete cascade,
  team_name  text not null,
  score      int not null,
  note       text,
  created_at timestamptz not null default now(),

  constraint scores_team_name_not_blank check (char_length(team_name) > 0),
  -- 前端限制 20 字（issue #3），這裡放寬到 60 字只是防止繞過前端直接打 API 塞超長字串，
  -- 不是真正的產品規格，避免兩層驗證邏輯打架。
  constraint scores_team_name_length check (char_length(team_name) <= 60),
  constraint scores_score_non_negative check (score >= 0)
);

comment on table public.scores is
  '一隊一筆、以第一筆為準（見 issue #1／#3）。送出後不可 update / delete，靠下方「不建政策」落地。';

-- 排行榜查詢的常用排序（分數高到低、同分先送出的在前）建索引，非必要但省得每次全表排序。
create index if not exists scores_room_leaderboard_idx
  on public.scores (room_code, score desc, created_at asc);


-- =====================================================================
-- 2. 隊名正規化（DB 層，trigger 版本）
-- =====================================================================
--
-- 規則：去前後空白、把連續空白壓成一個空白。
-- 用 BEFORE INSERT trigger 直接改寫 NEW.team_name，讓「A隊」與「A隊 」
-- 實際寫進資料庫的字串完全相同，唯一約束因此可以直接建在 team_name 欄位上，
-- 不需要另外開一個 generated column 才能達到「唯一約束建在正規化後的值上」。
--
-- 前端不能只靠自己 trim() 再送出：這只是最佳化使用者體感（見不到多餘空白），
-- 真正擋住「A隊」/「A隊 」繞過唯一約束的是這裡 —— 前端邏輯可以被繞過，DB 層不行。

create or replace function public.normalize_score_team_name()
returns trigger
language plpgsql
as $$
begin
  new.team_name := regexp_replace(btrim(new.team_name), '\s+', ' ', 'g');
  return new;
end;
$$;

drop trigger if exists trg_normalize_score_team_name on public.scores;
create trigger trg_normalize_score_team_name
  before insert on public.scores
  for each row
  execute function public.normalize_score_team_name();

-- 一隊一筆：因為上面的 trigger 保證寫入的 team_name 已經是正規化後的字串，
-- 這個唯一約束等同「同房間、同正規化隊名，只能有一筆成績」。
-- 這是唯一可靠的防重複來源 —— 前端「先查再寫」擋不住併發（issue #1／#3／#4 都提到）。
alter table public.scores
  drop constraint if exists scores_room_team_unique;
alter table public.scores
  add constraint scores_room_team_unique unique (room_code, team_name);


-- =====================================================================
-- 3. Row Level Security
-- =====================================================================

alter table public.rooms enable row level security;
alter table public.scores enable row level security;

-- 保險：先收回 Supabase 專案預設下放給 anon / authenticated 的完整權限，
-- 之後只重新授予真的需要的動作（甚至精確到欄位）。
-- 如果專案的 default privileges 沒有自動下放，這幾行是無害的 no-op。
revoke all on public.rooms  from anon, authenticated;
revoke all on public.scores from anon, authenticated;

grant usage on schema public to anon, authenticated;
-- scores.id 是 identity 欄位，insert 需要對其底層 sequence 有 usage 權限。
grant usage, select on all sequences in schema public to anon, authenticated;


-- ---------------------------------------------------------------------
-- 3.1 rooms 政策
-- ---------------------------------------------------------------------

grant select, insert on public.rooms to anon, authenticated;

-- rooms 只能改 locked 這一個欄位。
-- RLS 本身沒有「只允許 update 某欄位」的語法，所以搭配 column-level GRANT：
-- 先把整張表的 UPDATE 權限收掉（見上面 revoke all），再只開放 locked 這一欄。
-- 就算 RLS policy 通過，PostgREST 送出的 update 只要動到 locked 以外的欄位，
-- Postgres 會直接回 42501 拒絕，不會讓 title / code / created_at 被改到。
grant update (locked) on public.rooms to anon, authenticated;

-- 擋掉：完全沒有登入機制下仍然想讀到「不存在」以外的東西 —— 這裡沒有進一步限制。
-- 房號本身就是「知道才能查」的識別碼（4 碼、隨機、活動現場才公布），
-- rooms 資料（標題、鎖定狀態）本身也不是敏感資訊；
-- 且這個系統沒有帳號、沒有 JWT claim，RLS 沒有辦法驗證「這個請求者真的知道這個房號」，
-- 只能在「查得到 / 查不到」之間二選一，所以選擇開放查詢，讓 getRoom(code) 能正常運作。
drop policy if exists rooms_select_all on public.rooms;
create policy rooms_select_all
  on public.rooms
  for select
  to anon, authenticated
  using (true);

-- 擋掉：這條完全不擋，因為開房本來就是「任何人都可以」（主持人端沒有登入機制，issue #1）。
drop policy if exists rooms_insert_open on public.rooms;
create policy rooms_insert_open
  on public.rooms
  for insert
  to anon, authenticated
  with check (true);

-- 擋掉：這條 policy 本身管不到「只能改 locked」，那件事由上面的
-- column-level GRANT UPDATE (locked) 負責。這裡只負責「哪些 row 可以被改」，
-- 開放全部 row 是因為鎖房動作本來就需要能改到任何一間房（沒有房主帳號概念）。
drop policy if exists rooms_update_locked_only on public.rooms;
create policy rooms_update_locked_only
  on public.rooms
  for update
  to anon, authenticated
  using (true)
  with check (true);

-- 沒有 delete 政策、也沒有 grant delete：房間一律不可刪除（靠 room_code FK cascade
-- 交給資料庫管理者手動清理，見 issue #4「資料保留」）。


-- ---------------------------------------------------------------------
-- 3.2 scores 政策
-- ---------------------------------------------------------------------

grant select, insert on public.scores to anon, authenticated;
-- 刻意不 grant update / delete：成績送出後不可更正/刪除（issue #1／#3／#4），
-- 這是「不建政策 = 預設拒絕」之外的第二層保險。

-- 擋掉：insert 進「不存在的房間」或「已鎖的房間」。
-- 這是「送出成績前在 DB 層再確認一次房間沒鎖」的實際落地 —— 前端的
-- checkTeamName() / 樂觀判斷只是提早告知使用者體感好一點，真正擋下來的是這裡，
-- 繞過前端直接打 API 一樣會被擋。
drop policy if exists scores_insert_room_open on public.scores;
create policy scores_insert_room_open
  on public.scores
  for insert
  to anon, authenticated
  with check (
    exists (
      select 1
      from public.rooms r
      where r.code = scores.room_code
        and r.locked = false
    )
  );
-- 併發下也成立：WITH CHECK 是在每一列真正要寫入時（trigger 正規化 team_name 之後）
-- 用當下已 commit 的資料求值，不是前端「先查後寫」那種查詢跟寫入之間有空窗期的做法。
-- 鎖房（UPDATE rooms SET locked = true）一旦 commit，之後的 insert 一律查不到
-- locked = false 的那筆房間，不會有「明明鎖了還是插進去」的競態視窗。

-- 擋掉：本來想寫「只允許讀指定 room_code」，但做不到，原因如下 ——
--
-- 【誠實標註限制】這條政策實際上是「整張表都能讀」（using (true)），
-- 不是 issue #4 驗收條件寫的「只允許讀指定 room_code」。原因：
--   1. Supabase Realtime 的 postgres_changes 是直接訂閱資料表的 WAL 變更，
--      一個連線收不收得到某一列的事件，判斷依據是「這個角色對這張表有沒有
--      SELECT 權限、RLS 通不通得過」，不是「這次請求有沒有帶 room_code 篩選」。
--      RLS policy 沒有管道知道「這個 realtime 連線現在關心哪個房間」——
--      這個系統沒有帳號、沒有 per-room 的 JWT claim、沒有房間專屬密鑰，
--      所有玩家與主持人共用同一把 anon key，RLS 沒有依據可以分辨請求者身分。
--   2. 唯一能做到「列級隔離」的方法是改用 SECURITY DEFINER 的 RPC
--      （帶 room_code 參數，函式內部自己過濾），但那樣一來
--      Supabase Realtime 的 postgres_changes 就完全收不到事件了
--      （Realtime 只能訂閱資料表本身的 WAL，不能訂閱 RPC 呼叫的結果）——
--      而「主持人端即時看到新成績」正是 issue #1／#4 選 Supabase 而不是
--      自己寫輪詢的主要原因，兩者只能二選一，這裡選擇保留即時性。
--
-- 實際風險：任何拿到 anon key 的人（包含玩家瀏覽器開發者工具裡看得到的那把）
-- 可以讀到「所有活動、所有房間」的隊名／分數／備註，不只自己那一場的。
-- 緩解：這些資料本身敏感度低（沒有個資、沒有帳密，活動用完即刪 —— 見 issue #4
-- 「資料保留」段落），且沒有 rooms 的 listRooms 介面可用來枚舉房號、
-- room_code 是隨機 4 碼要先知道房號才查得到有意義的資料。
-- 但這確實是已知、刻意接受的資料外洩面，不是「符合驗收條件」的實作，
-- 在此明白寫出來，不假裝符合。
drop policy if exists scores_select_all on public.scores;
create policy scores_select_all
  on public.scores
  for select
  to anon, authenticated
  using (true);

-- 擋掉：所有 update 與 delete。
-- 故意不建任何 update / delete 政策 —— RLS 啟用後、沒有政策的操作對所有 row
-- 一律預設拒絕，等同「成績送出後不可更正/刪除」這條規則的 DB 層落地。
-- 上面也刻意不 grant update / delete，就算日後有人不小心多開一條政策，
-- 沒有對應的 GRANT 一樣完全動不了這張表的既有資料。


-- =====================================================================
-- 4. Realtime：讓主持人端能訂閱 scores 的 INSERT 事件
-- =====================================================================
--
-- 只需要 INSERT：成績不可 update / delete，主持人端不必處理其他事件類型
-- （見 issue #3：「因為成績不可 update/delete，主持人端只需要處理 INSERT」）。
-- 用 DO block 包一層是因為重複執行「ALTER PUBLICATION ... ADD TABLE」
-- 在該表已經是 publication 成員時會直接報錯，這樣寫可以讓整份腳本保持幂等。

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'scores'
  ) then
    alter publication supabase_realtime add table public.scores;
  end if;
end
$$;

-- =====================================================================
-- 完
-- =====================================================================
