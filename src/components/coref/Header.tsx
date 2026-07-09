import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { Search, ClipboardList, Menu, X } from "lucide-react";
import { CorefLogo } from "./Logo";
import { useEnquiry } from "@/lib/enquiry";

export function Header() {
  const { items } = useEnquiry();
  const [searchOpen, setSearchOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const links = [
    { to: "/products/tiles-flooring", label: "Products" },
    { to: "/how-it-works", label: "How It Works" },
    { to: "/suppliers/guangdong-elite-ceramics", label: "Suppliers" },
    { to: "/how-it-works", label: "About" },
  ] as const;

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-white/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link to="/" className="shrink-0">
          <CorefLogo />
        </Link>

        <nav className="hidden items-center gap-8 lg:flex">
          {links.map((l) => (
            <Link
              key={l.label}
              to={l.to}
              className="relative py-1 text-sm font-medium text-charcoal transition-colors hover:text-navy"
              activeProps={{ className: "text-navy border-b-2 border-ocean" }}
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <button
            aria-label="Search"
            onClick={() => setSearchOpen((s) => !s)}
            className="grid h-9 w-9 place-items-center rounded-md text-charcoal hover:bg-secondary"
          >
            <Search className="h-4 w-4" />
          </button>

          <Link
            to="/enquiry"
            className="relative grid h-9 w-9 place-items-center rounded-md text-charcoal hover:bg-secondary"
            aria-label="Enquiry list"
          >
            <ClipboardList className="h-5 w-5" />
            {items.length > 0 && (
              <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-green px-1 text-[10px] font-bold text-white">
                {items.length}
              </span>
            )}
          </Link>

          <Link
            to="/enquiry"
            className="hidden rounded-md bg-navy px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#1A5491] sm:inline-flex"
          >
            Start an Enquiry
          </Link>

          <button
            className="grid h-9 w-9 place-items-center rounded-md text-charcoal hover:bg-secondary lg:hidden"
            onClick={() => setMobileOpen((s) => !s)}
            aria-label="Menu"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {searchOpen && (
        <div className="border-t border-border bg-white px-4 py-3 sm:px-6">
          <div className="mx-auto max-w-7xl">
            <input
              autoFocus
              placeholder="Search products, categories, suppliers…"
              className="w-full rounded-md border border-input bg-offwhite px-4 py-2.5 text-sm outline-none focus:border-ocean"
            />
            <div className="mt-2 grid grid-cols-1 gap-2 text-xs text-mutedink sm:grid-cols-3">
              <div><span className="font-semibold text-navy">Products: </span>Porcelain tile, Marble slab, Sanitary mixer</div>
              <div><span className="font-semibold text-navy">Categories: </span>Tiles, Machinery, Lighting</div>
              <div><span className="font-semibold text-navy">Suppliers: </span>Verona Stone, Morbi Exporters</div>
            </div>
          </div>
        </div>
      )}

      {mobileOpen && (
        <div className="border-t border-border bg-white px-4 py-3 lg:hidden">
          {links.map((l) => (
            <Link
              key={l.label}
              to={l.to}
              className="block py-2 text-sm font-medium text-charcoal"
              onClick={() => setMobileOpen(false)}
            >
              {l.label}
            </Link>
          ))}
        </div>
      )}
    </header>
  );
}
