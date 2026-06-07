
-- 1. Product token pricing
ALTER TABLE public.digital_products
  ADD COLUMN IF NOT EXISTS token_price integer,
  ADD COLUMN IF NOT EXISTS accepts_money boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS accepts_tokens boolean NOT NULL DEFAULT false;

-- 2. Atomic token redemption
CREATE OR REPLACE FUNCTION public.redeem_product_with_tokens(_product_id uuid)
RETURNS TABLE(purchase_id uuid, remaining_balance integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  buyer uuid := auth.uid();
  prod record;
  bal integer;
  new_purchase uuid;
BEGIN
  IF buyer IS NULL THEN RAISE EXCEPTION 'Not signed in'; END IF;
  SELECT * INTO prod FROM public.digital_products WHERE id = _product_id AND status = 'active';
  IF NOT FOUND THEN RAISE EXCEPTION 'Product not available'; END IF;
  IF NOT prod.accepts_tokens OR prod.token_price IS NULL OR prod.token_price <= 0 THEN
    RAISE EXCEPTION 'This product does not accept tokens';
  END IF;
  IF prod.user_id = buyer THEN RAISE EXCEPTION 'You cannot buy your own product'; END IF;

  -- ensure buyer has wallet
  INSERT INTO public.user_tokens(user_id) VALUES (buyer) ON CONFLICT DO NOTHING;
  INSERT INTO public.user_tokens(user_id) VALUES (prod.user_id) ON CONFLICT DO NOTHING;

  SELECT balance INTO bal FROM public.user_tokens WHERE user_id = buyer FOR UPDATE;
  IF bal < prod.token_price THEN RAISE EXCEPTION 'Not enough tokens (have %, need %)', bal, prod.token_price; END IF;

  UPDATE public.user_tokens
    SET balance = balance - prod.token_price,
        total_spent = COALESCE(total_spent,0) + prod.token_price,
        updated_at = now()
    WHERE user_id = buyer
    RETURNING balance INTO bal;

  UPDATE public.user_tokens
    SET balance = COALESCE(balance,0) + prod.token_price,
        total_earned = COALESCE(total_earned,0) + prod.token_price,
        updated_at = now()
    WHERE user_id = prod.user_id;

  INSERT INTO public.product_purchases(product_id, buyer_id, seller_id, status, amount_cents, currency, metadata)
  VALUES (_product_id, buyer, prod.user_id, 'completed', 0, 'TOKENS', jsonb_build_object('paid_with','tokens','tokens',prod.token_price))
  RETURNING id INTO new_purchase;

  INSERT INTO public.token_transactions(from_user_id, to_user_id, amount, type, status)
  VALUES (buyer, prod.user_id, prod.token_price, 'product_purchase', 'completed');

  UPDATE public.digital_products SET sold_count = sold_count + 1, updated_at = now() WHERE id = _product_id;

  purchase_id := new_purchase;
  remaining_balance := bal;
  RETURN NEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION public.redeem_product_with_tokens(uuid) TO authenticated;

-- 3. Trigger: award tokens on video upload (1 reward per type per day)
CREATE OR REPLACE FUNCTION public.award_upload_tokens()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  reward integer;
  already_today int;
BEGIN
  reward := CASE WHEN NEW.is_short THEN 30 ELSE 50 END;

  SELECT count(*) INTO already_today
  FROM public.token_transactions
  WHERE to_user_id = NEW.user_id
    AND type = CASE WHEN NEW.is_short THEN 'upload_short' ELSE 'upload_long' END
    AND created_at::date = (now() at time zone 'utc')::date;

  IF already_today > 0 THEN RETURN NEW; END IF;

  INSERT INTO public.user_tokens(user_id) VALUES (NEW.user_id) ON CONFLICT DO NOTHING;
  UPDATE public.user_tokens
    SET balance = COALESCE(balance,0) + reward,
        total_earned = COALESCE(total_earned,0) + reward,
        updated_at = now()
    WHERE user_id = NEW.user_id;

  INSERT INTO public.token_transactions(from_user_id, to_user_id, amount, type, video_id, status)
  VALUES (NULL, NEW.user_id, reward,
          CASE WHEN NEW.is_short THEN 'upload_short' ELSE 'upload_long' END,
          NEW.id, 'completed');

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_award_upload_tokens ON public.videos;
CREATE TRIGGER trg_award_upload_tokens
  AFTER INSERT ON public.videos
  FOR EACH ROW EXECUTE FUNCTION public.award_upload_tokens();

-- 4. Top up nshtpanwar for testing
INSERT INTO public.user_tokens(user_id, balance, total_earned)
SELECT id, 999999999, 999999999 FROM public.profiles WHERE username = 'nshtpanwar'
ON CONFLICT (user_id) DO UPDATE
  SET balance = 999999999, total_earned = GREATEST(public.user_tokens.total_earned, 999999999), updated_at = now();
