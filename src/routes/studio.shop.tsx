import { createFileRoute, redirect } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, Trash2, Edit3, Link as LinkIcon, Save, X, Wallet } from "lucide-react";
import toast from "react-hot-toast";
import { AppHeader } from "@/components/AppHeader";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/studio/shop")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth" });
  },
  component: StudioShopPage,
});

const PROVIDERS = [
  { id: "stripe", label: "Stripe Payment Link" },
  { id: "paypal", label: "PayPal.me" },
  { id: "razorpay", label: "Razorpay Page" },
  { id: "upi", label: "UPI ID" },
  { id: "gumroad", label: "Gumroad" },
  { id: "lemonsqueezy", label: "LemonSqueezy" },
  { id: "custom_link", label: "Custom Checkout Link" },
] as const;

function StudioShopPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [showProductForm, setShowProductForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const { data: products = [] } = useQuery({
    queryKey: ["my-products", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("digital_products").select("*").eq("user_id", user!.id).order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: gateways = [] } = useQuery({
    queryKey: ["my-gateways", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("user_payment_gateways").select("*").eq("user_id", user!.id).order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const reload = () => {
    qc.invalidateQueries({ queryKey: ["my-products"] });
    qc.invalidateQueries({ queryKey: ["my-gateways"] });
  };

  return (
    <div className="min-h-screen bg-bg-primary text-text-primary">
      <AppHeader />
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        <div>
          <h1 className="font-display font-black text-3xl uppercase">Studio · Shop</h1>
          <p className="text-text-secondary text-sm">Sell digital products with your own payment gateway.</p>
        </div>

        {/* Payment gateways */}
        <section className="card-rise p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-display font-bold uppercase flex items-center gap-2"><Wallet className="w-5 h-5 text-brand-orange" /> Payment gateways</h2>
          </div>
          <p className="text-xs text-text-tertiary mb-4">Buyers will be sent directly to your payment link. We never touch your money.</p>
          <div className="space-y-2 mb-4">
            {gateways.length === 0 && <p className="text-sm text-text-tertiary">No gateways connected yet. Add one below.</p>}
            {gateways.map((g: any) => (
              <div key={g.id} className="flex items-center justify-between bg-bg-surface p-3 rounded-lg">
                <div className="min-w-0">
                  <p className="font-bold text-sm">{PROVIDERS.find(p => p.id === g.provider)?.label ?? g.provider}</p>
                  <p className="text-xs text-text-tertiary truncate">{g.account_identifier}</p>
                </div>
                <button onClick={async () => { await (supabase as any).from("user_payment_gateways").delete().eq("id", g.id); toast.success("Removed"); reload(); }} className="text-text-tertiary hover:text-accent-red"><Trash2 className="w-4 h-4" /></button>
              </div>
            ))}
          </div>
          <GatewayForm onSaved={reload} />
        </section>

        {/* Products */}
        <section className="card-rise p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display font-bold uppercase">Your products</h2>
            <button onClick={() => { setShowProductForm(true); setEditingId(null); }} className="btn-primary inline-flex items-center gap-2 text-sm py-2"><Plus className="w-4 h-4" /> New product</button>
          </div>

          {showProductForm && (
            <ProductForm
              gateways={gateways}
              editing={editingId ? products.find((p: any) => p.id === editingId) : null}
              onClose={() => { setShowProductForm(false); setEditingId(null); }}
              onSaved={() => { reload(); setShowProductForm(false); setEditingId(null); }}
            />
          )}

          <div className="space-y-2 mt-4">
            {products.length === 0 && !showProductForm && <p className="text-sm text-text-tertiary">No products yet.</p>}
            {products.map((p: any) => (
              <div key={p.id} className="flex items-center gap-3 bg-bg-surface p-3 rounded-lg">
                {p.cover_url ? <img src={p.cover_url} alt="" className="w-14 h-14 rounded-md object-cover" /> : <div className="w-14 h-14 rounded-md bg-bg-primary" />}
                <div className="flex-1 min-w-0">
                  <p className="font-bold truncate">{p.title}</p>
                  <p className="text-xs text-text-tertiary">{(p.price_cents/100).toLocaleString(undefined,{style:"currency",currency:p.currency})} · {p.status} · {p.sold_count} sold</p>
                </div>
                <button onClick={() => { setEditingId(p.id); setShowProductForm(true); }} className="text-text-secondary hover:text-text-primary p-2"><Edit3 className="w-4 h-4" /></button>
                <button onClick={async () => { if(!confirm("Delete this product?")) return; await (supabase as any).from("digital_products").delete().eq("id", p.id); reload(); }} className="text-text-tertiary hover:text-accent-red p-2"><Trash2 className="w-4 h-4" /></button>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function GatewayForm({ onSaved }: { onSaved: () => void }) {
  const { user } = useAuth();
  const [provider, setProvider] = useState<typeof PROVIDERS[number]["id"]>("stripe");
  const [identifier, setIdentifier] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!user || !identifier.trim()) return toast.error("Enter your payment URL or ID");
    setSaving(true);
    const { error } = await (supabase as any).from("user_payment_gateways").insert({
      user_id: user.id, provider, account_identifier: identifier.trim(), display_name: displayName.trim() || null,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    setIdentifier(""); setDisplayName("");
    toast.success("Gateway connected");
    onSaved();
  };

  return (
    <div className="grid sm:grid-cols-[160px_1fr_auto] gap-2">
      <select value={provider} onChange={e => setProvider(e.target.value as any)} className="px-3 py-2">
        {PROVIDERS.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
      </select>
      <input value={identifier} onChange={e => setIdentifier(e.target.value)} placeholder="https://buy.stripe.com/... or your UPI ID" className="px-3 py-2" />
      <button onClick={save} disabled={saving} className="btn-primary inline-flex items-center gap-2 text-sm py-2 px-4"><LinkIcon className="w-4 h-4" /> Connect</button>
    </div>
  );
}

function ProductForm({ gateways, editing, onClose, onSaved }: { gateways: any[]; editing: any | null; onClose: () => void; onSaved: () => void }) {
  const { user } = useAuth();
  const [title, setTitle] = useState(editing?.title ?? "");
  const [description, setDescription] = useState(editing?.description ?? "");
  const [price, setPrice] = useState(editing ? String(editing.price_cents / 100) : "9.99");
  const [currency, setCurrency] = useState(editing?.currency ?? "USD");
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [productFile, setProductFile] = useState<File | null>(null);
  const [gatewayId, setGatewayId] = useState<string>(editing?.payment_gateway_id ?? gateways[0]?.id ?? "");
  const [externalUrl, setExternalUrl] = useState(editing?.external_buy_url ?? "");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!user) return;
    if (!title.trim()) return toast.error("Title required");
    setSaving(true);
    try {
      let coverUrl = editing?.cover_url ?? null;
      if (coverFile) {
        const ext = coverFile.name.split(".").pop() || "jpg";
        const path = `${user.id}/product-covers/${Date.now()}.${ext}`;
        const { error } = await supabase.storage.from("thumbnails").upload(path, coverFile, { contentType: coverFile.type });
        if (error) throw error;
        coverUrl = supabase.storage.from("thumbnails").getPublicUrl(path).data.publicUrl;
      }
      let filePath: string | null = editing?.file_path ?? null;
      if (productFile) {
        const ext = productFile.name.split(".").pop() || "bin";
        filePath = `${user.id}/products/${crypto.randomUUID()}.${ext}`;
        const { error } = await supabase.storage.from("product-files").upload(filePath, productFile, { contentType: productFile.type });
        if (error) throw error;
      }

      const payload = {
        user_id: user.id,
        title: title.trim(),
        description: description.trim() || null,
        price_cents: Math.round(parseFloat(price || "0") * 100),
        currency: currency.toUpperCase(),
        cover_url: coverUrl,
        file_path: filePath,
        external_buy_url: externalUrl.trim() || null,
        payment_gateway_id: gatewayId || null,
        status: "active" as const,
      };

      const { error } = editing
        ? await (supabase as any).from("digital_products").update(payload).eq("id", editing.id)
        : await (supabase as any).from("digital_products").insert(payload);
      if (error) throw error;
      toast.success(editing ? "Updated" : "Listed");
      onSaved();
    } catch (e: any) {
      toast.error(e.message ?? "Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="border border-rise rounded-xl p-4 space-y-3 bg-bg-surface">
      <div className="flex items-center justify-between">
        <p className="font-bold uppercase text-sm">{editing ? "Edit product" : "New product"}</p>
        <button onClick={onClose} className="text-text-tertiary hover:text-text-primary"><X className="w-4 h-4" /></button>
      </div>
      <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Title" className="w-full px-3 py-2" />
      <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Description" className="w-full px-3 py-2 min-h-[60px]" />
      <div className="grid grid-cols-3 gap-2">
        <input value={price} onChange={e => setPrice(e.target.value)} placeholder="9.99" className="px-3 py-2 col-span-2" type="number" step="0.01" min="0" />
        <input value={currency} onChange={e => setCurrency(e.target.value)} placeholder="USD" className="px-3 py-2 uppercase" maxLength={3} />
      </div>
      <label className="block">
        <span className="text-xs uppercase text-text-secondary">Cover image</span>
        <input type="file" accept="image/*" onChange={e => setCoverFile(e.target.files?.[0] ?? null)} className="mt-1 block text-sm" />
      </label>
      <label className="block">
        <span className="text-xs uppercase text-text-secondary">Product file (optional — for delivery after purchase)</span>
        <input type="file" onChange={e => setProductFile(e.target.files?.[0] ?? null)} className="mt-1 block text-sm" />
      </label>
      <label className="block">
        <span className="text-xs uppercase text-text-secondary">Payment gateway</span>
        <select value={gatewayId} onChange={e => setGatewayId(e.target.value)} className="w-full px-3 py-2 mt-1">
          <option value="">— None —</option>
          {gateways.map(g => <option key={g.id} value={g.id}>{PROVIDERS.find(p => p.id === g.provider)?.label} · {g.account_identifier}</option>)}
        </select>
      </label>
      <input value={externalUrl} onChange={e => setExternalUrl(e.target.value)} placeholder="Direct buy URL (Stripe link, Gumroad, etc.)" className="w-full px-3 py-2" />
      <button onClick={handleSave} disabled={saving} className="btn-primary w-full inline-flex items-center justify-center gap-2"><Save className="w-4 h-4" /> {saving ? "Saving…" : "Save product"}</button>
    </div>
  );
}
