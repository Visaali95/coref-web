import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  useRouterState,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { EnquiryProvider } from "@/lib/enquiry";
import { Header } from "@/components/coref/Header";
import { Footer } from "@/components/coref/Footer";
import { WhatsAppFab } from "@/components/coref/WhatsAppFab";
import { EnquiryStickyBar } from "@/components/coref/EnquiryStickyBar";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="font-display text-7xl font-bold text-navy">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <div className="mt-6">
          <Link to="/" className="inline-flex items-center justify-center rounded-md bg-navy px-4 py-2 text-sm font-medium text-white hover:bg-[#1A5491]">
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold text-foreground">This page didn't load</h1>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => { router.invalidate(); reset(); }}
            className="rounded-md bg-navy px-4 py-2 text-sm font-medium text-white"
          >Try again</button>
          <a href="/" className="rounded-md border border-input bg-background px-4 py-2 text-sm font-medium">Go home</a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Coref — Global Sourcing & Logistics for Builders" },
      { name: "description", content: "Coref sources construction materials, machinery, and import goods from vetted international suppliers and handles logistics end-to-end." },
      { property: "og:title", content: "Coref — Global Sourcing & Logistics for Builders" },
      { name: "twitter:title", content: "Coref — Global Sourcing & Logistics for Builders" },
      { property: "og:description", content: "Coref sources construction materials, machinery, and import goods from vetted international suppliers and handles logistics end-to-end." },
      { name: "twitter:description", content: "Coref sources construction materials, machinery, and import goods from vetted international suppliers and handles logistics end-to-end." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/090170c4-ea21-4a90-a946-0ea8dcbc702a/id-preview-bf61576a--3bb0c390-72cc-4728-8ba7-534be24c667f.lovable.app-1782062967480.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/090170c4-ea21-4a90-a946-0ea8dcbc702a/id-preview-bf61576a--3bb0c390-72cc-4728-8ba7-534be24c667f.lovable.app-1782062967480.png" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:type", content: "website" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Syne:wght@600;700;800&family=Inter:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head><HeadContent /></head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isAdmin = pathname.startsWith("/admin");
  return (
    <QueryClientProvider client={queryClient}>
      <EnquiryProvider>
        <div className="flex min-h-screen flex-col">
          {!isAdmin && <Header />}
          <main className={isAdmin ? "flex-1" : "flex-1 pb-20"}>
            <Outlet />
          </main>
          {!isAdmin && <Footer />}
        </div>
        {!isAdmin && <EnquiryStickyBar />}
        {!isAdmin && <WhatsAppFab />}
      </EnquiryProvider>
    </QueryClientProvider>
  );
}
