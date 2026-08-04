-- Priorbyte — username moves to the sign-up form itself, which runs before
-- a session exists. is_username_available() needs to be callable by `anon`
-- for the same reason request_magic_link_allowed() already is.

grant execute on function public.is_username_available(text) to anon;
