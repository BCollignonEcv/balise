-- =============================================================================
-- Balise · Missions en temps réel côté participant
-- (une mission modifiée par l'admin pendant la partie apparaît sans recharger)
-- À exécuter une seule fois dans Supabase : SQL Editor > New query > Run.
-- =============================================================================

alter publication supabase_realtime add table public.missions;
