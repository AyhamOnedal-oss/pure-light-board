CREATE OR REPLACE FUNCTION public.member_can(_tenant uuid, _user uuid, _key text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select
    coalesce(public.tenant_role_at_least(_tenant, _user, 'admin'::tenant_role), false)
    or coalesce(public.has_role(_user, 'super_admin'::app_role), false)
    or exists (
      select 1 from public.team_members
      where tenant_id = _tenant
        and user_id = _user
        and (
          coalesce((permissions ->> _key)::boolean, false)
          or (
            _key like 'settings\_%' escape '\'
            and coalesce((permissions ->> 'settings')::boolean, false)
          )
        )
    );
$function$;