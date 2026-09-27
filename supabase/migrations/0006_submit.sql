-- =============================================================================
-- Balise · Étape 6 : envoi des réponses
-- À exécuter une seule fois dans Supabase : SQL Editor > New query > Run.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Utilitaires
-- -----------------------------------------------------------------------------

-- La partie accepte-t-elle des réponses maintenant ? (heure du serveur)
create or replace function public.game_accepts_answers(p_game_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.games
    where id = p_game_id
      and status = 'live'
      and archived_at is null
      and now() < deadline_at
      and (starts_at is null or now() >= starts_at)
  );
$$;

-- Comparaison de textes : sans casse, sans accents, espaces superflus ignorés.
-- Les apostrophes et guillemets typographiques (claviers iOS) sont unifiés.
create or replace function public.normalize_answer(p_value text)
returns text
language sql
stable
set search_path = ''
as $$
  select lower(
    regexp_replace(
      btrim(
        translate(extensions.unaccent(coalesce(p_value, '')), '’‘`´“”«»', '''''''''""""')
      ),
      '\s+', ' ', 'g'
    )
  );
$$;

-- Distance en mètres entre deux points GPS (formule de haversine)
create or replace function public.distance_m(
  p_lat1 double precision, p_lng1 double precision,
  p_lat2 double precision, p_lng2 double precision
)
returns double precision
language sql
immutable
set search_path = ''
as $$
  select 2 * 6371008.8 * asin(sqrt(
    power(sin(radians(p_lat2 - p_lat1) / 2), 2)
    + cos(radians(p_lat1)) * cos(radians(p_lat2)) * power(sin(radians(p_lng2 - p_lng1) / 2), 2)
  ));
$$;

-- -----------------------------------------------------------------------------
-- Stockage privé des médias envoyés par les équipes
-- Chemin : games/<game_id>/teams/<team_id>/<fichier>
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'submissions', 'submissions', false, 52428800,
  array[
    'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif',
    'video/mp4', 'video/quicktime', 'video/webm', 'video/3gpp'
  ]
)
on conflict (id) do nothing;

create or replace function public.submission_path_ids(p_name text, out game_id uuid, out team_id uuid)
language plpgsql
immutable
set search_path = ''
as $$
declare
  parts text[] := string_to_array(p_name, '/');
  uuid_re constant text := '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
begin
  if parts[1] = 'games' and parts[3] = 'teams' and parts[2] ~ uuid_re and parts[4] ~ uuid_re then
    game_id := parts[2]::uuid;
    team_id := parts[4]::uuid;
  end if;
end;
$$;

create or replace function public.can_upload_submission_media(p_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select ids.team_id is not null
    and ids.team_id = public.my_team_id(ids.game_id)
    and public.game_accepts_answers(ids.game_id)
  from public.submission_path_ids(p_name) as ids;
$$;

create or replace function public.can_read_submission_media(p_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select ids.team_id is not null and ids.team_id = public.my_team_id(ids.game_id)
  from public.submission_path_ids(p_name) as ids;
$$;

create policy "Équipe : envoi de médias" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'submissions' and public.can_upload_submission_media(name));

create policy "Équipe ou admin : lecture des médias" on storage.objects
  for select to authenticated
  using (bucket_id = 'submissions' and (public.is_admin() or public.can_read_submission_media(name)));

create policy "Admin : suppression des médias" on storage.objects
  for delete to authenticated
  using (bucket_id = 'submissions' and public.is_admin());

-- -----------------------------------------------------------------------------
-- Envoi d'une réponse
-- Toutes les règles sont vérifiées ici, avec l'heure du serveur.
-- p_media : [{ "path", "kind": "photo"|"video", "mime", "size_bytes", "width", "height", "duration_s" }]
-- -----------------------------------------------------------------------------
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
  v_uid         uuid := auth.uid();
  v_mission     public.missions;
  v_secret      public.mission_secrets;
  v_participant public.participants;
  v_game        public.games;
  v_text        text := nullif(btrim(coalesce(p_text, '')), '');
  v_comment     text := nullif(btrim(coalesce(p_comment, '')), '');
  v_has_gps     boolean := p_lat is not null and p_lng is not null;
  v_media       jsonb := coalesce(p_media, '[]'::jsonb);
  v_prefix      text;
  v_item        jsonb;
  v_used        integer;
  v_status      public.submission_status := 'pending';
  v_auto        boolean := false;
  v_wrong_text  boolean := false;
  v_too_far     boolean := false;
  v_missing_key boolean := false;
  v_distance    double precision;
  v_bonus_state public.bonus_state := 'none';
  v_id          uuid;
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
        v_missing_key := true;
      elsif public.normalize_answer(v_text) <> public.normalize_answer(v_secret.expected_answer) then
        v_wrong_text := true;
      end if;
    end if;

    if v_has_gps then
      if v_secret.target_lat is null or v_secret.target_lng is null or v_secret.radius_m is null then
        v_missing_key := true;
      else
        v_distance := public.distance_m(p_lat, p_lng, v_secret.target_lat, v_secret.target_lng);
        v_too_far := v_distance > v_secret.radius_m;
      end if;
    end if;

    if v_wrong_text or v_too_far then
      v_status := 'refused';
      v_auto := true;
    elsif not v_missing_key then
      v_status := 'validated';
      v_auto := true;
    end if;
    -- Réponse attendue non configurée : la soumission reste en attente pour l'admin.
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
    'bonus_pending', v_bonus_state = 'pending'
  );
end;
$$;

revoke execute on function public.submit_answer(uuid, text, double precision, double precision, double precision, text, jsonb) from public, anon;
grant execute on function public.submit_answer(uuid, text, double precision, double precision, double precision, text, jsonb) to authenticated;
