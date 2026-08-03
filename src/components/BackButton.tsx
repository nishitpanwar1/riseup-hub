import { useRouter } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

/**
 * Universal back affordance. Uses history when possible, otherwise falls back
 * to the feed so the user is never trapped on a sub-page.
 */
export function BackButton({ label, className = "" }: { label?: string; className?: string }) {
  const router = useRouter();
  const goBack = () => {
    if (typeof window !== "undefined" && window.history.length > 1) router.history.back();
    else router.navigate({ to: "/feed" });
  };
  return (
    <button
      type="button"
      onClick={goBack}
      aria-label="Go back"
      className={`inline-flex items-center gap-2 px-3 py-2 -ml-2 rounded-full text-sm font-semibold text-text-secondary hover:text-text-primary hover:bg-bg-surface transition-colors ${className}`}
    >
      <ArrowLeft className="w-5 h-5 shrink-0" />
      {label && <span className="truncate">{label}</span>}
    </button>
  );
}
