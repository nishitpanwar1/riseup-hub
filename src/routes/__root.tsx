import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect } from "react";
import { Toaster } from "react-hot-toast";

import appCss from "../styles.css?url";
import { supabase } from "@/integrations/supabase/client";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-bg-primary px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-black text-text-primary">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-text-primary">Page not found</h2>
        <p className="mt-2 text-sm text-text-secondary">
          This route does not exist in the Arena.
        </p>
        <div className="mt-6">
          <Link to="/" className="btn-primary inline-flex items-center justify-center">
            Back to home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  return (
    <div className="flex min-h-screen items-center justify-center bg-bg-primary px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold text-text-primary">Something broke</h1>
        <p className="mt-2 text-sm text-text-secondary">{error.message}</p>
        <button
          onClick={() => { router.invalidate(); reset(); }}
          className="btn-primary mt-6"
        >
          Try again
        </button>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "RiseUp — The platform built for your rise" },
      { name: "description", content: "RiseUp: a distraction-free short-video community for discipline, fitness, study, mindset and entrepreneurship." },
      { property: "og:title", content: "RiseUp — The platform built for your rise" },
      { property: "og:description", content: "Self-improvement first. No infinite scroll. No noise." },
      { property: "og:type", content: "website" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Montserrat:wght@700;800;900&family=Inter:wght@400;500;600;700&family=Space+Grotesk:wght@500;700&display=swap" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head><HeadContent /></head>
      <body className="bg-bg-primary">
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function AuthSync() {
  const router = useRouter();
  const qc = useQueryClient();
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      router.invalidate();
      qc.invalidateQueries();
    });
    return () => subscription.unsubscribe();
  }, [router, qc]);
  return null;
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <QueryClientProvider client={queryClient}>
      <AuthSync />
      <Outlet />
      <Toaster
        position="top-center"
        toastOptions={{
          style: { background: "#2D1155", color: "#F5F0FF", border: "1px solid #4A2D7A" },
        }}
      />
    </QueryClientProvider>
  );
}
