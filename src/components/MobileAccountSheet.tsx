import { Link, useNavigate } from "@tanstack/react-router";
import { createPortal } from "react-dom";
import { useEffect } from "react";
import {
  BarChart3, Bell, ChevronRight, Clock, Heart, History as HistoryIcon,
  LogOut, Settings, ShoppingBag, Upload, User as UserIcon, Users, X,
} from "lucide-react";
import { UserAvatar } from "@/components/UserAvatar";
import { supabase } from "@/integrations/supabase/client";

type Props = {
  open: boolean;
  onClose: () => void;
  username?: string | null;
  displayName?: string | null;
  avatarUrl?: string | null;
  email?: string | null;
};

/**
 * Native-app style account sheet (YouTube mobile "account" panel equivalent).
 * Slides up from the bottom on phones, giving quick access to Studio, channel
 * and library surfaces.
 */
export function MobileAccountSheet({ open, onClose, username, displayName, avatarUrl, email }: Props) {
  const nav = useNavigate();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);


  if (!open) return null;

  const signOut = async () => {
    onClose();
    await supabase.auth.signOut();
    nav({ to: "/" });
  };

  const Row = ({ to, params, icon, label, sub }: { to: string; params?: any; icon: React.ReactNode; label: string; sub?: string }) => (
    <Link
      to={to as any}
      params={params}
      onClick={onClose}
      className="flex items-center gap-4 px-5 py-3.5 active:bg-bg-surface"
    >
      <span className="text-text-secondary shrink-0">{icon}</span>
      <span className="flex-1 min-w-0">
        <span className="block text-sm font-semibold truncate">{label}</span>
        {sub && <span className="block text-xs text-text-tertiary truncate">{sub}</span>}
      </span>
      <ChevronRight className="w-4 h-4 text-text-tertiary shrink-0" />
    </Link>
  );

  // Rendered through a portal: the header uses backdrop-blur, which would
  // otherwise become the containing block and trap this fixed overlay.
  return createPortal(
    <div className="lg:hidden fixed inset-0 z-[70]">

      <button aria-label="Close menu" onClick={onClose} className="absolute inset-0 bg-black/70" />
      <div className="absolute inset-x-0 bottom-0 top-10 flex flex-col overflow-hidden rounded-t-3xl bg-bg-card border-t border-rise">
        <div className="shrink-0 bg-bg-card px-5 pt-3 pb-3 border-b border-rise">
          <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-bg-surface" />
          <div className="flex items-center gap-3">
            <UserAvatar src={avatarUrl} name={displayName ?? username} className="w-12 h-12" />
            <div className="min-w-0 flex-1">
              <p className="font-bold truncate">{displayName ?? username ?? "Your account"}</p>
              <p className="text-xs text-text-tertiary truncate">{username ? `@${username}` : email ?? ""}</p>
            </div>
            <button onClick={onClose} aria-label="Close" className="p-2 rounded-full hover:bg-bg-surface">
              <X className="w-5 h-5" />
            </button>
          </div>
          {username && (
            <Link
              to="/$username"
              params={{ username }}
              onClick={onClose}
              className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-brand-orange"
            >
              View your channel <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          )}
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
          <div className="py-1">
            <Row to="/studio" icon={<BarChart3 className="w-5 h-5" />} label="RiseUp Studio" sub="Dashboard, content, insights, comments" />
            <Row to="/studio/upload" icon={<Upload className="w-5 h-5" />} label="Upload video or short" />
            <Row to="/studio/shop" icon={<ShoppingBag className="w-5 h-5" />} label="Your products" sub="Sell for money or tokens" />
          </div>

          <div className="border-t border-rise py-1">
            <Row to="/feed" params={{ view: "history" }} icon={<HistoryIcon className="w-5 h-5" />} label="History" />
            <Row to="/feed" params={{ view: "liked" }} icon={<Heart className="w-5 h-5" />} label="Liked videos" />
            <Row to="/feed" params={{ view: "later" }} icon={<Clock className="w-5 h-5" />} label="Saved" />
            <Row to="/rooms" icon={<Users className="w-5 h-5" />} label="Accountability rooms" />
            <Row to="/notifications" icon={<Bell className="w-5 h-5" />} label="Notifications" />
          </div>

          <div className="border-t border-rise py-1">
            <Row to="/settings" icon={<Settings className="w-5 h-5" />} label="Settings" />
            {username && <Row to="/$username" params={{ username }} icon={<UserIcon className="w-5 h-5" />} label="Your channel" />}
            <button onClick={signOut} className="w-full flex items-center gap-4 px-5 py-3.5 active:bg-bg-surface text-left">
              <LogOut className="w-5 h-5 text-text-secondary shrink-0" />
              <span className="flex-1 text-sm font-semibold">Sign out</span>
            </button>
          </div>
        </div>
      </div>

    </div>,
    document.body
  );

}
