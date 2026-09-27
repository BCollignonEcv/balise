-- =============================================================================
-- Balise · Schéma initial
-- À exécuter une seule fois dans Supabase : SQL Editor > New query > Run.
-- =============================================================================

create extension if not exists unaccent with schema extensions;

-- -----------------------------------------------------------------------------
-- Types énumérés
-- -----------------------------------------------------------------------------
create type public.game_status as enum ('draft', 'live', 'finished');
create type public.answer_type as enum ('photo', 'video', 'text', 'gps');
create type public.validation_mode as enum ('manual', 'auto');
create type public.submission_status as enum ('pending', 'validated', 'refused');
create type public.bonus_state as enum ('none', 'pending', 'reviewed');

-- -----------------------------------------------------------------------------
-- Utilitaires
-- -----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- Administrateurs
-- -----------------------------------------------------------------------------
create table public.admins (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;

-- -----------------------------------------------------------------------------
-- Parties
-- -----------------------------------------------------------------------------

-- Code de partie lisible : sans 0/O ni 1/I/L pour éviter les confusions.
create or replace function public.generate_game_code()
returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
  alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  candidate text;
begin
  loop
    candidate := '';
    for i in 1..6 loop
      candidate := candidate || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from public.games where code = candidate);
  end loop;
  return candidate;
end;
$$;

create table public.games (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique check (code ~ '^[A-Z0-9]{4,12}$'),
  name        text not null check (length(btrim(name)) > 0),
  starts_at   timestamptz,
  deadline_at timestamptz not null,
  status      public.game_status not null default 'draft',
  archived_at timestamptz,
  theme       jsonb not null default '{}'::jsonb,
  custom_css  text not null default '',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  check (starts_at is null or starts_at < deadline_at)
);

alter table public.games alter column code set default public.generate_game_code();

create trigger games_updated_at before update on public.games
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Missions
-- -----------------------------------------------------------------------------
create table public.missions (
  id              uuid primary key default gen_random_uuid(),
  game_id         uuid not null references public.games (id) on delete cascade,
  position        integer not null default 0,
  title           text not null check (length(btrim(title)) > 0),
  description     text not null default '',
  image_path      text,
  base_points     integer not null default 0 check (base_points >= 0),
  answer_type     public.answer_type not null,
  validation_mode public.validation_mode not null default 'manual',
  -- 1 = non répétable
  max_validations integer not null default 1 check (max_validations >= 1),
  bonus_label     text,
  bonus_points    integer,
  bonus_max       integer,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (id, game_id),
  -- Bonus : soit rien, soit les trois champs renseignés
  check (
    (bonus_label is null and bonus_points is null and bonus_max is null)
    or (
      bonus_label is not null and bonus_points is not null and bonus_max is not null
      and length(btrim(bonus_label)) > 0 and bonus_points > 0 and bonus_max >= 1
    )
  )
);

create index missions_game_position_idx on public.missions (game_id, position);

create trigger missions_updated_at before update on public.missions
  for each row execute function public.set_updated_at();

-- Réponses attendues : jamais lisibles par les participants.
create table public.mission_secrets (
  mission_id      uuid primary key references public.missions (id) on delete cascade,
  expected_answer text,
  target_lat      double precision check (target_lat between -90 and 90),
  target_lng      double precision check (target_lng between -180 and 180),
  radius_m        integer check (radius_m > 0)
);

-- -----------------------------------------------------------------------------
-- Équipes et participants (propres à chaque partie)
-- -----------------------------------------------------------------------------
create table public.teams (
  id         uuid primary key default gen_random_uuid(),
  game_id    uuid not null references public.games (id) on delete cascade,
  name       text not null check (length(btrim(name)) > 0),
  color      text not null default '#0F5E63' check (color ~ '^#[0-9A-Fa-f]{6}$'),
  position   integer not null default 0,
  created_at timestamptz not null default now(),
  unique (id, game_id)
);

create unique index teams_game_name_idx on public.teams (game_id, lower(name));

create table public.participants (
  id         uuid primary key default gen_random_uuid(),
  game_id    uuid not null references public.games (id) on delete cascade,
  team_id    uuid,
  name       text not null check (length(btrim(name)) > 0),
  -- Session anonyme de l'appareil qui a sélectionné ce participant
  claimed_by uuid references auth.users (id) on delete set null,
  claimed_at timestamptz,
  created_at timestamptz not null default now(),
  foreign key (team_id, game_id) references public.teams (id, game_id) on delete set null (team_id)
);

create unique index participants_game_name_idx on public.participants (game_id, lower(name));
create index participants_claimed_by_idx on public.participants (claimed_by);

-- -----------------------------------------------------------------------------
-- Soumissions
-- -----------------------------------------------------------------------------
create table public.submissions (
  id             uuid primary key default gen_random_uuid(),
  game_id        uuid not null references public.games (id) on delete cascade,
  mission_id     uuid not null,
  team_id        uuid not null,
  participant_id uuid references public.participants (id) on delete set null,
  status         public.submission_status not null default 'pending',
  auto_validated boolean not null default false,
  text_answer    text,
  lat            double precision,
  lng            double precision,
  accuracy_m     double precision,
  distance_m     double precision,
  team_comment   text,
  admin_comment  text,
  bonus_count    integer not null default 0 check (bonus_count >= 0),
  bonus_state    public.bonus_state not null default 'none',
  reviewed_at    timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  foreign key (mission_id, game_id) references public.missions (id, game_id) on delete cascade,
  foreign key (team_id, game_id) references public.teams (id, game_id) on delete cascade
);

create index submissions_game_status_idx on public.submissions (game_id, status);
create index submissions_team_mission_idx on public.submissions (team_id, mission_id);

create trigger submissions_updated_at before update on public.submissions
  for each row execute function public.set_updated_at();

create table public.submission_media (
  id            uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.submissions (id) on delete cascade,
  path          text not null,
  kind          text not null check (kind in ('photo', 'video')),
  mime          text,
  size_bytes    bigint,
  width         integer,
  height        integer,
  duration_s    double precision,
  created_at    timestamptz not null default now()
);

create index submission_media_submission_idx on public.submission_media (submission_id);

-- -----------------------------------------------------------------------------
-- Ajustements manuels de points
-- -----------------------------------------------------------------------------
create table public.score_adjustments (
  id         uuid primary key default gen_random_uuid(),
  game_id    uuid not null references public.games (id) on delete cascade,
  team_id    uuid not null,
  points     integer not null check (points <> 0),
  reason     text not null check (length(btrim(reason)) > 0),
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  foreign key (team_id, game_id) references public.teams (id, game_id) on delete cascade
);

create index score_adjustments_team_idx on public.score_adjustments (team_id);

-- -----------------------------------------------------------------------------
-- Duplication d'une partie : missions + thème, sans équipes ni participants
-- -----------------------------------------------------------------------------
create or replace function public.duplicate_game(p_game_id uuid)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_new_game_id uuid;
  v_mission record;
  v_new_mission_id uuid;
begin
  if not public.is_admin() then
    raise exception 'Accès réservé à l''administrateur' using errcode = '42501';
  end if;

  insert into public.games (name, starts_at, deadline_at, status, theme, custom_css)
  select name || ' (copie)', starts_at, deadline_at, 'draft'::public.game_status, theme, custom_css
  from public.games
  where id = p_game_id
  returning id into v_new_game_id;

  if v_new_game_id is null then
    raise exception 'Partie introuvable' using errcode = 'P0002';
  end if;

  for v_mission in
    select * from public.missions where game_id = p_game_id order by position
  loop
    insert into public.missions (
      game_id, position, title, description, image_path, base_points, answer_type,
      validation_mode, max_validations, bonus_label, bonus_points, bonus_max
    ) values (
      v_new_game_id, v_mission.position, v_mission.title, v_mission.description,
      v_mission.image_path, v_mission.base_points, v_mission.answer_type,
      v_mission.validation_mode, v_mission.max_validations, v_mission.bonus_label,
      v_mission.bonus_points, v_mission.bonus_max
    )
    returning id into v_new_mission_id;

    insert into public.mission_secrets (mission_id, expected_answer, target_lat, target_lng, radius_m)
    select v_new_mission_id, expected_answer, target_lat, target_lng, radius_m
    from public.mission_secrets
    where mission_id = v_mission.id;
  end loop;

  return v_new_game_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- Sécurité (RLS)
-- Les participants utilisent une connexion anonyme : ils ont aussi le rôle
-- « authenticated ». Toutes les règles admin passent donc par is_admin().
-- Les règles participant seront ajoutées à l'étape 4.
-- -----------------------------------------------------------------------------
alter table public.admins            enable row level security;
alter table public.games             enable row level security;
alter table public.missions          enable row level security;
alter table public.mission_secrets   enable row level security;
alter table public.teams             enable row level security;
alter table public.participants      enable row level security;
alter table public.submissions       enable row level security;
alter table public.submission_media  enable row level security;
alter table public.score_adjustments enable row level security;

create policy "Un utilisateur voit s'il est admin" on public.admins
  for select to authenticated using (user_id = auth.uid());

create policy "Admin : parties" on public.games
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "Admin : missions" on public.missions
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "Admin : réponses attendues" on public.mission_secrets
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "Admin : équipes" on public.teams
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "Admin : participants" on public.participants
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "Admin : soumissions" on public.submissions
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "Admin : médias" on public.submission_media
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "Admin : ajustements" on public.score_adjustments
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Droits d'accès via l'API (les règles RLS ci-dessus filtrent ensuite les lignes)
grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
revoke all on all tables in schema public from anon;

revoke execute on function public.duplicate_game(uuid) from public, anon;
grant execute on function public.duplicate_game(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- Enregistrement du compte administrateur
-- -----------------------------------------------------------------------------
insert into public.admins (user_id)
select id from auth.users where email = 'jeuxjoues@gmail.com'
on conflict do nothing;

-- Vérification : doit renvoyer une ligne avec ton email
select u.email, a.created_at as admin_depuis
from public.admins a
join auth.users u on u.id = a.user_id;
