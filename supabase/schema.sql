-- Match Day Optimizer: tables (all prefixed md_ so they can live inside any existing Supabase project).
-- Run this once in Supabase: SQL Editor -> New query -> paste -> Run.
-- Row Level Security is switched on with no policies: only our server (service role key) can read/write.

create table if not exists md_matches (
  id text primary key,
  seq int not null unique,            -- chronological order; the date gate compares this
  season text not null,
  match_number int,
  match_date date not null,
  venue text not null,
  venue_full text,
  city text,
  team1 text not null,
  team2 text not null,
  toss_winner text,
  toss_decision text,
  winner text,
  result_text text,
  player_of_match text,
  inn1_runs int,
  inn2_runs int,
  is_ipl2026 boolean not null default false
);
create index if not exists md_matches_venue_idx on md_matches (venue, seq);

create table if not exists md_players (
  id text primary key,
  name text not null,
  role text not null,                 -- WK | BAT | AR | BOWL
  role_source text not null           -- history | ai | default
);

create table if not exists md_match_players (
  match_id text not null references md_matches(id) on delete cascade,
  player_id text not null references md_players(id),
  team text not null,
  primary key (match_id, player_id)
);
-- Note: md_match_players holds only each side's starting XI. Impact Players / concussion substitutes are out of scope and
-- are recorded in md_meta under the key 'impact_players' (shown after a match for context, never in the pool).

-- dated evidence: one row per player per match, with the computed Dream11 points
create table if not exists md_player_stats (
  match_id text not null references md_matches(id) on delete cascade,
  player_id text not null references md_players(id),
  team text not null,
  opponent text not null,
  venue text not null,
  match_date date not null,
  seq int not null,
  bat_pos int,
  runs int not null default 0,
  balls int not null default 0,
  fours int not null default 0,
  sixes int not null default 0,
  dismissed boolean not null default false,
  balls_bowled int not null default 0,
  runs_conceded int not null default 0,
  wickets int not null default 0,
  lbw_bowled int not null default 0,
  maidens int not null default 0,
  catches int not null default 0,
  stumpings int not null default 0,
  ro_direct int not null default 0,
  ro_indirect int not null default 0,
  d11 numeric not null default 0,
  primary key (match_id, player_id)
);
create index if not exists md_player_stats_player_idx on md_player_stats (player_id, seq);

create table if not exists md_meta (
  key text primary key,
  value jsonb not null
);

-- the scoring weights, versioned: every learning step that changes anything writes a new row
create table if not exists md_weights (
  version int primary key,
  factors jsonb not null,
  role_mult jsonb not null,
  venue_mult jsonb not null,
  note text,
  created_at timestamptz not null default now()
);

-- what the system recommended for a match (one row per match, replaced on regenerate)
create table if not exists md_recommendations (
  match_id text primary key references md_matches(id) on delete cascade,
  weights_version int not null,
  generated_at timestamptz not null default now(),
  data_cutoff_seq int not null,
  venue_profile jsonb,
  team jsonb not null,
  captain_id text not null,
  vice_id text not null,
  expected_total numeric,
  total_credits numeric,
  checks jsonb,
  bench jsonb,
  reasoning jsonb,
  used_fallback boolean not null default false,
  model text
);

-- PREDICTED scores: every pool player gets one, selected or not
create table if not exists md_predictions (
  match_id text not null references md_matches(id) on delete cascade,
  player_id text not null references md_players(id),
  weights_version int not null,
  team text not null,
  role text not null,
  role_source text,
  credit numeric not null,
  credit_source text not null default 'estimated',
  predicted numeric not null,
  base_predicted numeric not null,
  venue_type text not null,
  factors jsonb not null,
  selected boolean not null default false,
  is_captain boolean not null default false,
  is_vice boolean not null default false,
  history_matches int,
  created_at timestamptz not null default now(),
  primary key (match_id, player_id)
);

-- ACTUAL scores: typed in by Aryan after the match (raw Dream11 points, before captain multipliers)
create table if not exists md_actuals (
  match_id text not null references md_matches(id) on delete cascade,
  player_id text not null references md_players(id),
  actual_points numeric not null,
  entered_at timestamptz not null default now(),
  primary key (match_id, player_id)
);

-- what the learning loop did after each entry
create table if not exists md_learning_log (
  id bigserial primary key,
  after_match_id text references md_matches(id) on delete cascade,
  created_at timestamptz not null default now(),
  weights_before int not null,
  weights_after int not null,
  changed boolean not null,
  observations int not null,
  matches int not null,
  model_mae numeric,
  baseline_mae numeric,
  factor_mae jsonb,
  buckets jsonb,
  notes jsonb
);

alter table md_matches enable row level security;
alter table md_players enable row level security;
alter table md_match_players enable row level security;
alter table md_player_stats enable row level security;
alter table md_meta enable row level security;
alter table md_weights enable row level security;
alter table md_recommendations enable row level security;
alter table md_predictions enable row level security;
alter table md_actuals enable row level security;
alter table md_learning_log enable row level security;
