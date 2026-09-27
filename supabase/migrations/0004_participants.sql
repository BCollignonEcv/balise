-- =============================================================================
-- Balise · Étape 4 : équipes, participants, rejoindre une partie
-- À exécuter une seule fois dans Supabase : SQL Editor > New query > Run.
-- =============================================================================

-- Un appareil (session anonyme) ne peut incarner qu'un seul participant par partie.
create unique index participants_game_claimed_by_idx
  on public.participants (game_id, claimed_by)
  where claimed_by is not null;

-- -----------------------------------------------------------------------------
-- Fonctions d'appartenance (security definer : évite la récursion des règles RLS)
-- -----------------------------------------------------------------------------
create or replace function public.is_game_member(p_game_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.participants
    where game_id = p_game_id and claimed_by = auth.uid()
  );
$$;

create or replace function public.my_team_id(p_game_id uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select team_id from public.participants
  where game_id = p_game_id and claimed_by = auth.uid()
  limit 1;
$$;

-- -----------------------------------------------------------------------------
-- Règles de lecture pour les participants
-- -----------------------------------------------------------------------------
create policy "Participant : sa partie" on public.games
  for select to authenticated using (public.is_game_member(id));

create policy "Participant : équipes de sa partie" on public.teams
  for select to authenticated using (public.is_game_member(game_id));

create policy "Participant : membres de son équipe" on public.participants
  for select to authenticated using (team_id is not null and team_id = public.my_team_id(game_id));

create policy "Participant : missions de sa partie" on public.missions
  for select to authenticated using (
    public.is_game_member(game_id)
    and exists (select 1 from public.games g where g.id = game_id and g.status <> 'draft')
  );

-- -----------------------------------------------------------------------------
-- Écran « rejoindre » : informations publiques d'une partie à partir de son code.
-- Accessible sans session. « me » = participant déjà choisi par cet appareil.
-- -----------------------------------------------------------------------------
create or replace function public.get_join_info(p_code text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_game public.games;
  v_me jsonb;
  v_participants jsonb;
begin
  select * into v_game
  from public.games
  where code = upper(btrim(p_code)) and archived_at is null;

  if not found then
    return jsonb_build_object('error', 'not_found');
  end if;
  if v_game.status = 'draft' then
    return jsonb_build_object('error', 'not_open', 'name', v_game.name);
  end if;

  if auth.uid() is not null then
    select jsonb_build_object(
      'id', p.id, 'name', p.name,
      'team_id', t.id, 'team_name', t.name, 'team_color', t.color
    )
    into v_me
    from public.participants p
    join public.teams t on t.id = p.team_id
    where p.game_id = v_game.id and p.claimed_by = auth.uid();
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
      'id', p.id, 'name', p.name,
      'team_name', t.name, 'team_color', t.color,
      'taken', p.claimed_by is not null
    ) order by lower(p.name)), '[]'::jsonb)
  into v_participants
  from public.participants p
  join public.teams t on t.id = p.team_id
  where p.game_id = v_game.id;

  return jsonb_build_object(
    'game', jsonb_build_object(
      'id', v_game.id, 'code', v_game.code, 'name', v_game.name, 'status', v_game.status,
      'starts_at', v_game.starts_at, 'deadline_at', v_game.deadline_at,
      'theme', v_game.theme, 'custom_css', v_game.custom_css
    ),
    'participants', v_participants,
    'me', v_me,
    'server_now', now()
  );
end;
$$;

grant execute on function public.get_join_info(text) to anon, authenticated;

-- -----------------------------------------------------------------------------
-- Sélection d'un participant : verrouillée côté serveur.
-- L'UPDATE conditionnel garantit qu'un seul appareil gagne en cas de clic simultané.
-- -----------------------------------------------------------------------------
create or replace function public.claim_participant(p_participant_id uuid)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_participant public.participants;
  v_status public.game_status;
  v_existing uuid;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  select * into v_participant from public.participants where id = p_participant_id;
  if not found or v_participant.team_id is null then
    raise exception 'participant_not_found' using errcode = 'P0002';
  end if;

  select status into v_status
  from public.games
  where id = v_participant.game_id and archived_at is null;
  if v_status is null or v_status = 'draft' then
    raise exception 'game_not_open' using errcode = 'P0001';
  end if;

  -- Cet appareil a déjà choisi un nom dans cette partie : on le garde.
  select id into v_existing
  from public.participants
  where game_id = v_participant.game_id and claimed_by = v_uid;
  if v_existing is not null then
    return v_existing;
  end if;

  update public.participants
  set claimed_by = v_uid, claimed_at = now()
  where id = p_participant_id and claimed_by is null;

  if not found then
    raise exception 'already_taken' using errcode = 'P0001';
  end if;

  return p_participant_id;
end;
$$;

revoke execute on function public.claim_participant(uuid) from public, anon;
grant execute on function public.claim_participant(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- Réinitialisation : prévient l'appareil concerné en temps réel (canal game:<id>).
-- -----------------------------------------------------------------------------
create or replace function public.notify_participant_released()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.claimed_by is not null
     and (tg_op = 'DELETE' or new.claimed_by is distinct from old.claimed_by) then
    begin
      perform realtime.send(
        jsonb_build_object('participant_id', old.id),
        'participant_released',
        'game:' || old.game_id::text,
        false
      );
    exception when others then
      -- La notification est un confort : elle ne doit jamais bloquer la réinitialisation.
      null;
    end;
  end if;
  return coalesce(new, old);
end;
$$;

create trigger participants_released_notify
  after update of claimed_by or delete on public.participants
  for each row execute function public.notify_participant_released();

-- Suivi en direct des sélections côté admin
alter publication supabase_realtime add table public.participants;
