import { Link } from "@tanstack/react-router";
import { INFO_ORDER, INFO_PAGES } from "@/lib/info-content";

const PRIMARY = ["about", "press", "copyright", "contact", "creators", "advertise", "developers"];
const SECONDARY = ["terms", "privacy", "policy-safety", "how-riseup-works", "test-new-features"];

export function SiteFooterLinks({ className = "" }: { className?: string }) {
  const row = (slugs: string[]) =>
    slugs
      .filter((s) => INFO_PAGES[s])
      .map((s) => (
        <Link
          key={s}
          to="/info/$slug"
          params={{ slug: s }}
          className="hover:text-text-primary transition-colors"
        >
          {INFO_PAGES[s].short}
        </Link>
      ));

  return (
    <footer className={`text-xs text-text-tertiary ${className}`}>
      <div className="flex flex-wrap gap-x-3 gap-y-1.5 font-semibold">{row(PRIMARY)}</div>
      <div className="flex flex-wrap gap-x-3 gap-y-1.5 mt-2.5 font-semibold">{row(SECONDARY)}</div>
      <p className="mt-4 text-text-tertiary/70">© {new Date().getFullYear()} RiseUp Media</p>
    </footer>
  );
}

export { INFO_ORDER };
