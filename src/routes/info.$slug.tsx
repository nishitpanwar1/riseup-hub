import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { AppHeader } from "@/components/AppHeader";
import { SiteFooterLinks } from "@/components/SiteFooterLinks";
import { INFO_ORDER, INFO_PAGES, type InfoPage } from "@/lib/info-content";

export const Route = createFileRoute("/info/$slug")({
  loader: ({ params }) => {
    const page = INFO_PAGES[params.slug];
    if (!page) throw notFound();
    return { page };
  },
  head: ({ params, loaderData }) => {
    const page = loaderData?.page;
    if (!page) {
      return {
        meta: [{ title: "Page not found — RiseUp" }, { name: "robots", content: "noindex" }],
      };
    }
    return {
      meta: [
        { title: `${page.title} — RiseUp` },
        { name: "description", content: page.tagline },
        { property: "og:title", content: `${page.title} — RiseUp` },
        { property: "og:description", content: page.tagline },
        { property: "og:type", content: "article" },
        { property: "og:url", content: `/info/${params.slug}` },
        { name: "twitter:card", content: "summary" },
      ],
      links: [{ rel: "canonical", href: `/info/${params.slug}` }],
    };
  },
  notFoundComponent: InfoNotFound,
  errorComponent: ({ error }) => (
    <div className="min-h-screen bg-bg-primary text-text-primary p-10" role="alert">
      {error.message}
    </div>
  ),
  component: InfoPageView,
});

function InfoPageView() {
  const { page } = Route.useLoaderData() as { page: InfoPage };
  const { slug } = Route.useParams();

  return (
    <div className="min-h-screen bg-bg-primary text-text-primary">
      <AppHeader />
      <div className="max-w-[1100px] mx-auto px-4 sm:px-6 py-8 grid lg:grid-cols-[220px_1fr] gap-8">
        <nav className="card-rise p-2 h-fit lg:sticky lg:top-20">
          <div className="text-[10px] font-bold uppercase tracking-wider text-text-tertiary px-3 pt-2 pb-1">
            More from RiseUp
          </div>
          {INFO_ORDER.map((s) => (
            <Link
              key={s}
              to="/info/$slug"
              params={{ slug: s }}
              className={`block px-3 py-2 rounded-lg text-sm font-semibold transition-colors ${
                s === slug
                  ? "bg-bg-surface text-text-primary"
                  : "text-text-secondary hover:text-text-primary hover:bg-bg-surface/60"
              }`}
            >
              {INFO_PAGES[s].short}
            </Link>
          ))}
        </nav>

        <main>
          <h1 className="font-display font-black text-3xl sm:text-4xl uppercase leading-tight">{page.title}</h1>
          <p className="text-text-secondary mt-2 text-lg">{page.tagline}</p>
          <div className="mt-8 space-y-8">
            {page.sections.map((sec) => (
              <section key={sec.heading} className="card-rise p-6">
                <h2 className="font-display font-black text-xl uppercase tracking-tight">{sec.heading}</h2>
                <div className="mt-3 space-y-3">
                  {sec.body.map((p, i) => (
                    <p key={i} className="text-text-secondary leading-relaxed">{p}</p>
                  ))}
                </div>
              </section>
            ))}
          </div>
          <SiteFooterLinks className="mt-10 border-t border-rise pt-6" />
        </main>
      </div>
    </div>
  );
}

function InfoNotFound() {
  return (
    <div className="min-h-screen bg-bg-primary text-text-primary">
      <AppHeader />
      <div className="max-w-xl mx-auto px-6 py-24 text-center">
        <h1 className="font-display font-black text-3xl uppercase">Page not found</h1>
        <p className="text-text-secondary mt-2">That information page doesn't exist.</p>
        <Link to="/feed" className="btn-primary inline-block mt-6">Back to home</Link>
      </div>
    </div>
  );
}
