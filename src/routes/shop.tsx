import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { ShoppingBag, Tag, Plus, Coins } from "lucide-react";
import toast from "react-hot-toast";
import { AppHeader } from "@/components/AppHeader";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/shop")({
  component: ShopPage,
});

function ShopPage() {
  const { user } = useAuth();
  const { data: products = [], isLoading, refetch } = useQuery({
    queryKey: ["shop-products"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("digital_products")
        .select("id, title, description, price_cents, currency, cover_url, category, tags, sold_count, user_id, external_buy_url, accepts_money, accepts_tokens, token_price, profiles:user_id(username, display_name, avatar_url)")
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(60);
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: tokens } = useQuery({
    queryKey: ["my-tokens", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("user_tokens").select("balance").eq("user_id", user!.id).maybeSingle();
      return data?.balance ?? 0;
    },
  });

  useEffect(() => {
    const ch = supabase.channel("shop-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "digital_products" }, () => refetch())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [refetch]);

  return (
    <div className="min-h-screen bg-bg-primary text-text-primary">
      <AppHeader />
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-8">
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div>
            <h1 className="font-display font-black text-3xl uppercase flex items-center gap-2">
              <ShoppingBag className="w-7 h-7 text-brand-orange" /> Shop
            </h1>
            <p className="text-text-secondary text-sm">Pay with money or with tokens you earned by uploading.</p>
          </div>
          <div className="flex items-center gap-3">
            {user && (
              <span className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-bg-surface border border-rise text-sm">
                <Coins className="w-4 h-4 text-brand-purple" />
                <span className="font-stat font-bold">{(tokens ?? 0).toLocaleString()}</span>
                <span className="text-text-tertiary text-xs uppercase">tokens</span>
              </span>
            )}
            {user && (
              <Link to="/studio/shop" className="btn-primary inline-flex items-center gap-2"><Plus className="w-4 h-4" /> Sell a product</Link>
            )}
          </div>
        </div>

        {isLoading ? (
          <p className="text-text-secondary">Loading…</p>
        ) : products.length === 0 ? (
          <div className="card-rise p-12 text-center">
            <p className="text-text-secondary mb-4">No products yet. Be the first to list one.</p>
            {user && <Link to="/studio/shop" className="btn-primary inline-block">List a product</Link>}
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {products.map((p: any) => <ProductCard key={p.id} product={p} onPurchased={() => refetch()} />)}
          </div>
        )}
      </div>
    </div>
  );
}

function ProductCard({ product, onPurchased }: { product: any; onPurchased: () => void }) {
  const { user } = useAuth();
  const [buying, setBuying] = useState(false);
  const profile = Array.isArray(product.profiles) ? product.profiles[0] : product.profiles;
  const acceptsMoney = product.accepts_money !== false;
  const acceptsTokens = !!product.accepts_tokens && !!product.token_price;
  const price = (product.price_cents / 100).toLocaleString(undefined, { style: "currency", currency: product.currency || "USD" });

  const buyWithTokens = async () => {
    if (!user) return toast.error("Sign in first");
    if (!confirm(`Spend ${product.token_price} tokens on "${product.title}"?`)) return;
    setBuying(true);
    const { data, error } = await (supabase as any).rpc("redeem_product_with_tokens", { _product_id: product.id });
    setBuying(false);
    if (error) return toast.error(error.message);
    const remaining = Array.isArray(data) ? data[0]?.remaining_balance : data?.remaining_balance;
    toast.success(`Purchased! ${remaining ?? "?"} tokens left.`);
    onPurchased();
  };

  return (
    <div className="card-rise overflow-hidden group flex flex-col">
      <div className="aspect-video bg-bg-surface relative">
        {product.cover_url ? (
          <img src={product.cover_url} alt={product.title} className="w-full h-full object-cover" loading="lazy" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-text-tertiary"><Tag className="w-8 h-8" /></div>
        )}
        <div className="absolute top-2 right-2 flex flex-col gap-1 items-end">
          {acceptsMoney && <span className="px-2 py-1 rounded-md bg-black/70 text-xs font-stat font-bold">{price}</span>}
          {acceptsTokens && <span className="px-2 py-1 rounded-md bg-brand-purple/90 text-xs font-stat font-bold inline-flex items-center gap-1"><Coins className="w-3 h-3" />{product.token_price}</span>}
        </div>
      </div>
      <div className="p-4 flex-1 flex flex-col">
        <h3 className="font-display font-bold uppercase line-clamp-2">{product.title}</h3>
        {product.description && <p className="text-sm text-text-tertiary mt-1 line-clamp-2">{product.description}</p>}
        {profile && (
          <Link to="/$username" params={{ username: profile.username }} className="mt-2 text-xs text-text-secondary hover:text-text-primary">
            @{profile.username}
          </Link>
        )}
        <div className="mt-auto pt-3 space-y-2">
          {acceptsMoney && product.external_buy_url && (
            <a href={product.external_buy_url} target="_blank" rel="noopener noreferrer" className="btn-primary w-full text-center text-sm py-2 block">
              Buy for {price}
            </a>
          )}
          {acceptsTokens && (
            <button onClick={buyWithTokens} disabled={buying} className="w-full text-sm py-2 rounded-lg bg-brand-purple text-white font-bold inline-flex items-center justify-center gap-2 disabled:opacity-50">
              <Coins className="w-4 h-4" /> {buying ? "Processing…" : `Buy with ${product.token_price} tokens`}
            </button>
          )}
          {!acceptsTokens && acceptsMoney && !product.external_buy_url && (
            <button className="btn-ghost w-full text-sm py-2" disabled>Seller hasn't set a payment link</button>
          )}
        </div>
      </div>
    </div>
  );
}
