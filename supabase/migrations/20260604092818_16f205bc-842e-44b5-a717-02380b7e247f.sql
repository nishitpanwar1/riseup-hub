CREATE TABLE IF NOT EXISTS public.user_payment_gateways (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  provider text NOT NULL CHECK (provider IN ('stripe','paypal','razorpay','upi','gumroad','lemonsqueezy','custom_link')),
  account_identifier text NOT NULL,
  display_name text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_payment_gateways TO authenticated;
GRANT ALL ON public.user_payment_gateways TO service_role;

ALTER TABLE public.user_payment_gateways ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Users manage own payment gateways" ON public.user_payment_gateways
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.digital_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  payment_gateway_id uuid REFERENCES public.user_payment_gateways(id) ON DELETE SET NULL,
  title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 140),
  description text,
  category text,
  tags text[] NOT NULL DEFAULT '{}',
  price_cents integer NOT NULL DEFAULT 0 CHECK (price_cents >= 0),
  currency text NOT NULL DEFAULT 'USD' CHECK (char_length(currency) = 3),
  cover_url text,
  file_path text,
  external_buy_url text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('draft','active','archived')),
  sold_count integer NOT NULL DEFAULT 0 CHECK (sold_count >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.digital_products TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.digital_products TO authenticated;
GRANT ALL ON public.digital_products TO service_role;

ALTER TABLE public.digital_products ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Anyone views active products" ON public.digital_products
  FOR SELECT TO anon, authenticated
  USING (status = 'active' OR auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Users create own products" ON public.digital_products
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Users update own products" ON public.digital_products
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Users delete own products" ON public.digital_products
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.product_purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.digital_products(id) ON DELETE CASCADE,
  buyer_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  seller_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','delivered','refunded','cancelled')),
  amount_cents integer NOT NULL DEFAULT 0 CHECK (amount_cents >= 0),
  currency text NOT NULL DEFAULT 'USD' CHECK (char_length(currency) = 3),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.product_purchases TO authenticated;
GRANT ALL ON public.product_purchases TO service_role;

ALTER TABLE public.product_purchases ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Users view own purchase activity" ON public.product_purchases
  FOR SELECT TO authenticated
  USING (auth.uid() = buyer_id OR auth.uid() = seller_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Users create own purchase intent" ON public.product_purchases
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = buyer_id OR auth.uid() = seller_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Sellers update own purchases" ON public.product_purchases
  FOR UPDATE TO authenticated
  USING (auth.uid() = seller_id)
  WITH CHECK (auth.uid() = seller_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TRIGGER touch_user_payment_gateways_updated_at
BEFORE UPDATE ON public.user_payment_gateways
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TRIGGER touch_digital_products_updated_at
BEFORE UPDATE ON public.digital_products
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TRIGGER touch_product_purchases_updated_at
BEFORE UPDATE ON public.product_purchases
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

GRANT SELECT ON public.profiles TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
GRANT SELECT ON public.videos TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.videos TO authenticated;
GRANT ALL ON public.videos TO service_role;
GRANT SELECT ON public.video_likes TO anon;
GRANT SELECT, INSERT, DELETE ON public.video_likes TO authenticated;
GRANT ALL ON public.video_likes TO service_role;
GRANT SELECT, INSERT, DELETE ON public.video_saves TO authenticated;
GRANT ALL ON public.video_saves TO service_role;
GRANT INSERT ON public.video_views TO anon;
GRANT SELECT, INSERT ON public.video_views TO authenticated;
GRANT ALL ON public.video_views TO service_role;
GRANT SELECT ON public.video_comments TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.video_comments TO authenticated;
GRANT ALL ON public.video_comments TO service_role;
GRANT SELECT, UPDATE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
GRANT SELECT, INSERT, DELETE ON public.follows TO authenticated;
GRANT ALL ON public.follows TO service_role;

DO $$ BEGIN
  CREATE TRIGGER video_likes_bump_count
  AFTER INSERT OR DELETE ON public.video_likes
  FOR EACH ROW EXECUTE FUNCTION public.bump_like_count();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER video_saves_bump_count
  AFTER INSERT OR DELETE ON public.video_saves
  FOR EACH ROW EXECUTE FUNCTION public.bump_save_count();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER video_views_bump_count
  AFTER INSERT ON public.video_views
  FOR EACH ROW EXECUTE FUNCTION public.bump_view_count();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER video_comments_bump_count
  AFTER INSERT OR DELETE ON public.video_comments
  FOR EACH ROW EXECUTE FUNCTION public.bump_comment_count();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER follows_bump_counts
  AFTER INSERT OR DELETE ON public.follows
  FOR EACH ROW EXECUTE FUNCTION public.bump_follow_counts();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER video_likes_notify
  AFTER INSERT ON public.video_likes
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_like();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER follows_notify
  AFTER INSERT ON public.follows
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_follow();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER video_comments_notify
  AFTER INSERT ON public.video_comments
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_comment();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DROP POLICY IF EXISTS "Auth upload videos" ON storage.objects;
DROP POLICY IF EXISTS "Owner delete videos" ON storage.objects;
DROP POLICY IF EXISTS "Auth upload thumbs" ON storage.objects;
DROP POLICY IF EXISTS "Owner delete thumbs" ON storage.objects;

CREATE POLICY "Auth upload own video files" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'videos' AND auth.uid() IS NOT NULL AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Owner manages own video files" ON storage.objects
FOR UPDATE TO authenticated
USING (bucket_id = 'videos' AND auth.uid()::text = (storage.foldername(name))[1])
WITH CHECK (bucket_id = 'videos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Owner deletes own video files" ON storage.objects
FOR DELETE TO authenticated
USING (bucket_id = 'videos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Auth upload own thumbnail files" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'thumbnails' AND auth.uid() IS NOT NULL AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Owner manages own thumbnail files" ON storage.objects
FOR UPDATE TO authenticated
USING (bucket_id = 'thumbnails' AND auth.uid()::text = (storage.foldername(name))[1])
WITH CHECK (bucket_id = 'thumbnails' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Owner deletes own thumbnail files" ON storage.objects
FOR DELETE TO authenticated
USING (bucket_id = 'thumbnails' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users upload own product files" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'product-files' AND auth.uid() IS NOT NULL AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users read own product files" ON storage.objects
FOR SELECT TO authenticated
USING (bucket_id = 'product-files' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users update own product files" ON storage.objects
FOR UPDATE TO authenticated
USING (bucket_id = 'product-files' AND auth.uid()::text = (storage.foldername(name))[1])
WITH CHECK (bucket_id = 'product-files' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users delete own product files" ON storage.objects
FOR DELETE TO authenticated
USING (bucket_id = 'product-files' AND auth.uid()::text = (storage.foldername(name))[1]);

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.videos;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.video_comments;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.digital_products;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.user_payment_gateways;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;