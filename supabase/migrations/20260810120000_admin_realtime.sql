-- Publish public tables used as invalidation signals by the admin dashboard.
-- Admin data is still fetched through APIs protected by requireAdmin().
DO $$
DECLARE
  table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY['profiles', 'users', 'subscriptions', 'projects', 'companies', 'companies_users'] LOOP
    IF to_regclass(format('public.%I', table_name)) IS NOT NULL
       AND NOT EXISTS (
         SELECT 1 FROM pg_publication_tables
         WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = table_name
       ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', table_name);
    END IF;
  END LOOP;
END $$;
