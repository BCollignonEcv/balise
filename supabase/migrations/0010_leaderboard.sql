-- =============================================================================
-- Balise · Étape 8 : classement en direct
-- À exécuter une seule fois dans Supabase : SQL Editor > New query > Run.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Classement d'une partie : uniquement les totaux par équipe (un participant ne
-- voit jamais le détail des réponses des autres équipes).
-- Score = soumissions validées (base + bonus) + ajustements manuels.
-- -----------------------------------------------------------------------------
create or replace function public.get_leaderboard(p_game_id uuid)
returns table (
  team_id            uuid,
  name               text,
  color              text,
  base_points        bigint,
  bonus_points       bigint,
  adjustment_points  bigint,
  total_points       bigint,
  validated_missions bigint,
  rank               bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  with validated as (
    select s.team_id,
           sum(m.base_points)::bigint                                  as base,
           sum(s.bonus_count * coalesce(m.bonus_points, 0))::bigint    as bonus,
           count(distinct s.mission_id)::bigint                        as missions
    from public.submissions s
    join public.missions m on m.id = s.mission_id
    where s.game_id = p_game_id and s.status = 'validated'
    group by s.team_id
  ),
  adjusted as (
    select a.team_id, sum(a.points)::bigint as points
    from public.score_adjustments a
    where a.game_id = p_game_id
    group by a.team_id
  ),
  scored as (
    select t.id, t.name, t.color, t.position,
           coalesce(v.base, 0)     as base,
           coalesce(v.bonus, 0)    as bonus,
           coalesce(a.points, 0)   as adjustments,
           coalesce(v.base, 0) + coalesce(v.bonus, 0) + coalesce(a.points, 0) as total,
           coalesce(v.missions, 0) as missions
    from public.teams t
    left join validated v on v.team_id = t.id
    left join adjusted a on a.team_id = t.id
    where t.game_id = p_game_id
      and (public.is_admin() or public.is_game_member(p_game_id))
  )
  select id, name, color, base, bonus, adjustments, total, missions,
         rank() over (order by total desc)
  from scored
  order by total desc, position, name;
$$;

revoke execute on function public.get_leaderboard(uuid) from public, anon;
grant execute on function public.get_leaderboard(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- Signal « scores modifiés » sur le canal de la partie : les téléphones
-- rechargent alors le classement.
-- -----------------------------------------------------------------------------
create or replace function public.notify_scores_changed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_game_id uuid := coalesce(new.game_id, old.game_id);
begin
  begin
    perform realtime.send(
      jsonb_build_object('at', now()),
      'scores_changed',
      'game:' || v_game_id::text,
      false
    );
  exception when others then
    -- Confort uniquement : ne doit jamais bloquer une validation.
    null;
  end;
  return null;
end;
$$;

create trigger submissions_scores_notify
  after insert or update or delete on public.submissions
  for each row execute function public.notify_scores_changed();

create trigger score_adjustments_scores_notify
  after insert or update or delete on public.score_adjustments
  for each row execute function public.notify_scores_changed();

-- Nom ou couleur d'équipe modifiés : le classement doit aussi se rafraîchir.
create trigger teams_scores_notify
  after update of name, color on public.teams
  for each row execute function public.notify_scores_changed();
