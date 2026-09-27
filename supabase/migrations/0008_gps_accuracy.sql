-- =============================================================================
-- Balise · Position GPS imprécise : vérification manuelle
-- Si la marge d'erreur du GPS dépasse le rayon de la mission, la réponse n'est
-- ni validée ni refusée automatiquement : elle reste en attente pour l'admin.
-- À exécuter une seule fois dans Supabase : SQL Editor > New query > Run.
-- =============================================================================

create or replace function public.submit_answer(
  p_mission_id uuid,
  p_text       text default null,
  p_lat        double precision default null,
  p_lng        double precision default null,
  p_accuracy   double precision default null,
  p_comment    text default null,
  p_media      jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid          uuid := auth.uid();
  v_mission      public.missions;
  v_secret       public.mission_secrets;
  v_participant  public.participants;
  v_game         public.games;
  v_text         text := nullif(btrim(coalesce(p_text, '')), '');
  v_comment      text := nullif(btrim(coalesce(p_comment, '')), '');
  v_has_gps      boolean := p_lat is not null and p_lng is not null;
  v_media        jsonb := coalesce(p_media, '[]'::jsonb);
  v_prefix       text;
  v_item         jsonb;
  v_used         integer;
  v_status       public.submission_status := 'pending';
  v_auto         boolean := false;
  v_wrong_text   boolean := false;
  v_too_far      boolean := false;
  v_imprecise    boolean := false;
  v_needs_review boolean := false;
  v_distance     double precision;
  v_bonus_state  public.bonus_state := 'none';
  v_id           uuid;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  select * into v_mission from public.missions where id = p_mission_id;
  if not found then
    raise exception 'mission_not_found' using errcode = 'P0002';
  end if;

  select * into v_participant
  from public.participants
  where game_id = v_mission.game_id and claimed_by = v_uid;
  if not found or v_participant.team_id is null then
    raise exception 'not_a_member' using errcode = '42501';
  end if;

  -- Date limite : contrôlée avec l'heure du serveur
  select * into v_game from public.games where id = v_mission.game_id;
  if v_game.status <> 'live' or v_game.archived_at is not null or now() >= v_game.deadline_at then
    raise exception 'deadline_passed' using errcode = 'P0001';
  end if;
  if v_game.starts_at is not null and now() < v_game.starts_at then
    raise exception 'not_started' using errcode = 'P0001';
  end if;

  -- Contenu : au moins une réponse, uniquement des types acceptés
  if jsonb_typeof(v_media) <> 'array' or jsonb_array_length(v_media) > 10 then
    raise exception 'invalid_media' using errcode = '22023';
  end if;
  if v_text is null and not v_has_gps and jsonb_array_length(v_media) = 0 then
    raise exception 'empty_answer' using errcode = '22023';
  end if;
  if v_text is not null and not ('text' = any (v_mission.answer_types)) then
    raise exception 'type_not_allowed' using errcode = '22023';
  end if;
  if v_has_gps and not ('gps' = any (v_mission.answer_types)) then
    raise exception 'type_not_allowed' using errcode = '22023';
  end if;

  v_prefix := 'games/' || v_game.id || '/teams/' || v_participant.team_id || '/';
  for v_item in select value from jsonb_array_elements(v_media) loop
    if coalesce(v_item ->> 'kind', '') not in ('photo', 'video')
       or not ((v_item ->> 'kind')::public.answer_type = any (v_mission.answer_types)) then
      raise exception 'type_not_allowed' using errcode = '22023';
    end if;
    if left(coalesce(v_item ->> 'path', ''), length(v_prefix)) <> v_prefix then
      raise exception 'invalid_media' using errcode = '22023';
    end if;
  end loop;

  -- Plafond de répétitions (verrou par équipe + mission contre les envois simultanés)
  perform pg_advisory_xact_lock(hashtextextended(v_participant.team_id::text || v_mission.id::text, 0));
  select count(*) into v_used
  from public.submissions
  where team_id = v_participant.team_id
    and mission_id = v_mission.id
    and status in ('validated', 'pending');
  if v_used >= v_mission.max_validations then
    raise exception 'max_reached' using errcode = 'P0001';
  end if;

  -- Validation automatique : seuls le texte et le GPS sont vérifiés
  if v_mission.validation_mode = 'auto' then
    select * into v_secret from public.mission_secrets where mission_id = v_mission.id;

    if v_text is not null then
      if v_secret.expected_answer is null then
        v_needs_review := true;
      elsif public.normalize_answer(v_text) <> public.normalize_answer(v_secret.expected_answer) then
        v_wrong_text := true;
      end if;
    end if;

    if v_has_gps then
      if v_secret.target_lat is null or v_secret.target_lng is null or v_secret.radius_m is null then
        v_needs_review := true;
      else
        v_distance := public.distance_m(p_lat, p_lng, v_secret.target_lat, v_secret.target_lng);
        -- Marge d'erreur du GPS plus grande que la zone : impossible de trancher, l'admin décidera.
        v_imprecise := p_accuracy is not null and p_accuracy > v_secret.radius_m;
        if v_imprecise then
          v_needs_review := true;
        else
          v_too_far := v_distance > v_secret.radius_m;
        end if;
      end if;
    end if;

    if v_wrong_text or v_too_far then
      v_status := 'refused';
      v_auto := true;
    elsif not v_needs_review then
      v_status := 'validated';
      v_auto := true;
    end if;
  end if;

  -- Les bonus sont toujours vérifiés par l'admin
  if v_status = 'validated' and v_mission.bonus_label is not null then
    v_bonus_state := 'pending';
  end if;

  insert into public.submissions (
    game_id, mission_id, team_id, participant_id, status, auto_validated,
    text_answer, lat, lng, accuracy_m, distance_m, team_comment, bonus_state, reviewed_at
  ) values (
    v_game.id, v_mission.id, v_participant.team_id, v_participant.id, v_status, v_auto,
    v_text,
    case when v_has_gps then p_lat end,
    case when v_has_gps then p_lng end,
    case when v_has_gps then p_accuracy end,
    v_distance, v_comment, v_bonus_state,
    case when v_auto then now() end
  )
  returning id into v_id;

  insert into public.submission_media (submission_id, path, kind, mime, size_bytes, width, height, duration_s)
  select v_id,
         value ->> 'path',
         value ->> 'kind',
         value ->> 'mime',
         (value ->> 'size_bytes')::bigint,
         (value ->> 'width')::integer,
         (value ->> 'height')::integer,
         (value ->> 'duration_s')::double precision
  from jsonb_array_elements(v_media);

  -- La distance n'est pas renvoyée à l'équipe (pour ne pas guider au « chaud / froid »).
  return jsonb_build_object(
    'id', v_id,
    'status', v_status,
    'auto', v_auto,
    'wrong_text', v_wrong_text,
    'too_far', v_too_far,
    'imprecise', v_imprecise,
    'bonus_pending', v_bonus_state = 'pending'
  );
end;
$$;
