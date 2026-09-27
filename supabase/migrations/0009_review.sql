-- =============================================================================
-- Balise · Étape 7 : validation des soumissions par l'admin
-- À exécuter une seule fois dans Supabase : SQL Editor > New query > Run.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Décision de l'admin sur une soumission : valider (avec bonus), refuser,
-- ou remettre en attente (ex. annuler une validation automatique).
-- Possible même après la date limite.
-- -----------------------------------------------------------------------------
create or replace function public.review_submission(
  p_submission_id uuid,
  p_status        public.submission_status,
  p_bonus_count   integer default 0,
  p_comment       text default null
)
returns public.submissions
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  v_sub       public.submissions;
  v_mission   public.missions;
  v_validated integer;
  v_bonus     integer := coalesce(p_bonus_count, 0);
begin
  if not public.is_admin() then
    raise exception 'Accès réservé à l''administrateur' using errcode = '42501';
  end if;

  select * into v_sub from public.submissions where id = p_submission_id for update;
  if not found then
    raise exception 'submission_not_found' using errcode = 'P0002';
  end if;
  select * into v_mission from public.missions where id = v_sub.mission_id;

  if p_status = 'validated' then
    -- Une mission ne peut pas dépasser son nombre maximum de validations
    perform pg_advisory_xact_lock(hashtextextended(v_sub.team_id::text || v_sub.mission_id::text, 0));
    select count(*) into v_validated
    from public.submissions
    where team_id = v_sub.team_id
      and mission_id = v_sub.mission_id
      and status = 'validated'
      and id <> v_sub.id;
    if v_validated >= v_mission.max_validations then
      raise exception 'max_reached' using errcode = 'P0001';
    end if;

    if v_mission.bonus_label is null then
      v_bonus := 0;
    elsif v_bonus < 0 or v_bonus > v_mission.bonus_max then
      raise exception 'invalid_bonus' using errcode = '22023';
    end if;
  else
    v_bonus := 0;
  end if;

  update public.submissions
  set status         = p_status,
      bonus_count    = v_bonus,
      bonus_state    = case
                         when p_status = 'validated' and v_mission.bonus_label is not null
                         then 'reviewed'::public.bonus_state
                         else 'none'::public.bonus_state
                       end,
      admin_comment  = nullif(btrim(coalesce(p_comment, '')), ''),
      auto_validated = false,
      reviewed_at    = case when p_status = 'pending' then null else now() end
  where id = p_submission_id
  returning * into v_sub;

  return v_sub;
end;
$$;

revoke execute on function public.review_submission(uuid, public.submission_status, integer, text) from public, anon;
grant execute on function public.review_submission(uuid, public.submission_status, integer, text) to authenticated;

-- -----------------------------------------------------------------------------
-- Réinitialisation des réponses d'une partie (répétition avant le vrai jeu).
-- Supprime soumissions et ajustements ; missions, équipes et participants sont
-- conservés. Renvoie les chemins des fichiers à supprimer du stockage.
-- -----------------------------------------------------------------------------
create or replace function public.reset_game_responses(p_game_id uuid)
returns text[]
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  v_paths text[];
begin
  if not public.is_admin() then
    raise exception 'Accès réservé à l''administrateur' using errcode = '42501';
  end if;

  select coalesce(array_agg(m.path), '{}')
  into v_paths
  from public.submission_media m
  join public.submissions s on s.id = m.submission_id
  where s.game_id = p_game_id;

  delete from public.submissions where game_id = p_game_id;
  delete from public.score_adjustments where game_id = p_game_id;

  return v_paths;
end;
$$;

revoke execute on function public.reset_game_responses(uuid) from public, anon;
grant execute on function public.reset_game_responses(uuid) to authenticated;
