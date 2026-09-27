-- =============================================================================
-- Balise · Étape 5 : lecture des soumissions de son équipe, temps réel
-- À exécuter une seule fois dans Supabase : SQL Editor > New query > Run.
-- =============================================================================

-- Un participant voit les soumissions, médias et ajustements de SON équipe uniquement.
create policy "Participant : soumissions de son équipe" on public.submissions
  for select to authenticated using (team_id = public.my_team_id(game_id));

create policy "Participant : médias de son équipe" on public.submission_media
  for select to authenticated using (
    exists (
      select 1 from public.submissions s
      where s.id = submission_id and s.team_id = public.my_team_id(s.game_id)
    )
  );

create policy "Participant : ajustements de son équipe" on public.score_adjustments
  for select to authenticated using (team_id = public.my_team_id(game_id));

-- Diffusion en direct (filtrée par les règles ci-dessus) :
--  - games : prolongation de la date limite, passage en « terminée »
--  - submissions / score_adjustments : statuts et score de l'équipe
alter publication supabase_realtime add table public.games, public.submissions, public.score_adjustments;
