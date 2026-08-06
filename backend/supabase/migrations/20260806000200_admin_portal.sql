-- Priorbyte — admin portal support: the one missing RLS policy an admin
-- needs to actually manage users.
--
-- Every other table the admin portal touches (knowledge_graph,
-- knowledge_graph_edges, allowed_email_domains, courses, course_staff) already
-- has an admin-bypass policy from earlier migrations. profiles never did:
-- "admin reads all" existed for SELECT, but there was no admin UPDATE policy
-- at all, so an admin could see a user's role but never change it through
-- normal RLS-scoped access. guard_profile_privileges already special-cases
-- is_admin() to bypass every restriction on UPDATE -- this policy is what
-- lets that bypass actually get reached.

create policy "profiles: admin updates all"
  on public.profiles for update
  using (public.is_admin())
  with check (public.is_admin());
