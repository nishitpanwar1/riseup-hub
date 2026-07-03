REVOKE EXECUTE ON FUNCTION public.redeem_product_with_tokens(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.check_in_streak() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.redeem_product_with_tokens(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_in_streak() TO authenticated;