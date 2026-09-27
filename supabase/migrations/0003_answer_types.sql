-- =============================================================================
-- Balise · Plusieurs types de réponse par mission
-- À exécuter une seule fois dans Supabase (après 0002) : SQL Editor > New query > Run.
--
-- Règle : l'équipe envoie au moins une réponse parmi les types acceptés.
-- En validation automatique, seuls le texte et le GPS sont vérifiés ; une
-- réponse ne contenant que photo/vidéo est validée dès l'envoi.
-- -----------------------------------------------------------------------------

alter table public.missions add column answer_types public.answer_type[];
update public.missions set answer_types = array[answer_type];
alter table public.missions
  alter column answer_types set not null,
  add constraint missions_answer_types_check check (cardinality(answer_types) between 1 and 4);
alter table public.missions drop column answer_type;

-- La duplication de partie doit copier la nouvelle colonne
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
      game_id, position, title, description, image_path, base_points, answer_types,
      validation_mode, max_validations, bonus_label, bonus_points, bonus_max
    ) values (
      v_new_game_id, v_mission.position, v_mission.title, v_mission.description,
      v_mission.image_path, v_mission.base_points, v_mission.answer_types,
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
