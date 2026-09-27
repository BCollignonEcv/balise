-- =============================================================================
-- Balise · Étape 3 : missions
-- À exécuter une seule fois dans Supabase : SQL Editor > New query > Run.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Stockage des images publiques (illustrations de missions, images de thème)
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'assets', 'assets', true, 5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml']
)
on conflict (id) do nothing;

create policy "Admin : lecture assets" on storage.objects
  for select to authenticated using (bucket_id = 'assets' and public.is_admin());
create policy "Admin : ajout assets" on storage.objects
  for insert to authenticated with check (bucket_id = 'assets' and public.is_admin());
create policy "Admin : modification assets" on storage.objects
  for update to authenticated using (bucket_id = 'assets' and public.is_admin());
create policy "Admin : suppression assets" on storage.objects
  for delete to authenticated using (bucket_id = 'assets' and public.is_admin());

-- -----------------------------------------------------------------------------
-- Une mission qui a déjà reçu des réponses ne peut pas être supprimée
-- (la suppression d'une partie entière reste possible).
-- -----------------------------------------------------------------------------
alter table public.submissions drop constraint submissions_mission_id_game_id_fkey;
alter table public.submissions
  add constraint submissions_mission_id_game_id_fkey
  foreign key (mission_id, game_id) references public.missions (id, game_id)
  on delete no action;

-- -----------------------------------------------------------------------------
-- Réordonnancement des missions en une seule opération
-- -----------------------------------------------------------------------------
create or replace function public.reorder_missions(p_game_id uuid, p_mission_ids uuid[])
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Accès réservé à l''administrateur' using errcode = '42501';
  end if;

  update public.missions m
  set position = t.ord::int
  from unnest(p_mission_ids) with ordinality as t (id, ord)
  where m.id = t.id and m.game_id = p_game_id;
end;
$$;

revoke execute on function public.reorder_missions(uuid, uuid[]) from public, anon;
grant execute on function public.reorder_missions(uuid, uuid[]) to authenticated;
