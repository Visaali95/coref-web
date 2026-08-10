import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Info, Check, Loader2 } from "lucide-react";
import { getCategory, CATEGORIES, PRODUCTS } from "@/lib/catalog";
import { useEnquiry } from "@/lib/enquiry";
import { apiFetch } from "@/lib/api";

export const Route = createFileRoute("/products/$category")({
  head: ({ params }) => {
    const cat = getCategory(params.category);
    const title = cat ? `${cat.name} — Coref` : "Products — Coref";
    return {
      meta: [
        { title },
        { name: "description", content: `Browse ${cat?.name ?? "products"} from vetted international suppliers via Coref.` },
        { property: "og:title", content: title },
      ],
    };
  },
  component: CategoryPage,
});

// ─── DB Product type (matches backend schema) ──────────────────────────────────
const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000";

type DbProduct = {
  id: number;
  name: string;
  category: string;
  supplier: string;
  fobPrice: string;
  leadTime?: string;
  imageUrl?: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
};

// ─── Filter options extracted from available DB products ──────────────────────
const LEAD_BUCKETS = ["Under 4 weeks", "4–8 weeks", "8–12 weeks", "Over 12 weeks"] as const;

function bucketLeadTime(leadTime?: string): string {
  if (!leadTime) return "Unknown";
  const lower = leadTime.toLowerCase();
  const num = parseInt(lower, 10);
  if (lower.includes("day")) return "Under 4 weeks";
  if (!isNaN(num)) {
    const weeks = lower.includes("month") ? num * 4 : num;
    if (weeks <= 4) return "Under 4 weeks";
    if (weeks <= 8) return "4–8 weeks";
    if (weeks <= 12) return "8–12 weeks";
    return "Over 12 weeks";
  }
  if (lower.includes("under 4")) return "Under 4 weeks";
  if (lower.includes("4") || lower.includes("6")) return "4–8 weeks";
  if (lower.includes("8") || lower.includes("10") || lower.includes("12")) return "8–12 weeks";
  return "Unknown";
}

function CategoryPage() {
  const { category } = Route.useParams();
  const cat = getCategory(category) ?? CATEGORIES[0];

  const [supplierFilter, setSupplierFilter] = useState<string[]>([]);
  const [leadFilter, setLeadFilter] = useState<string[]>([]);
  const [search, setSearch] = useState("");

  const { data: allPublished = [], isLoading } = useQuery<DbProduct[]>({
    queryKey: ["products", "published"],
    queryFn: () => apiFetch<DbProduct[]>("/api/products/published"),
    staleTime: 30_000,
  });

  // Convert mock catalog products into DbProduct structure to ensure all categories display items
  const catalogAsDbProducts = useMemo<DbProduct[]>(() => {
    return PRODUCTS.map((p, index) => ({
      id: 10000 + index + 1,
      name: p.name,
      category: p.category,
      supplier: p.supplier,
      fobPrice: `₹${p.priceMin}–${p.priceMax} / ${p.unit}`,
      leadTime: p.leadTime,
      status: "Published",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }));
  }, []);

  // Merge DB published products with catalog products (deduplicating by name)
  const combinedProducts = useMemo(() => {
    const dbNames = new Set(allPublished.map((p) => p.name.toLowerCase()));
    const extraCatalog = catalogAsDbProducts.filter((p) => !dbNames.has(p.name.toLowerCase()));
    return [...allPublished, ...extraCatalog];
  }, [allPublished, catalogAsDbProducts]);

  // Normalize a string to a slug for flexible matching
  const toSlug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

  // Filter to current category — matches by:
  // 1. Exact catalog name match  e.g. "Tiles & Flooring"
  // 2. Slug of stored category matches URL slug  e.g. "machinery" → "machinery"
  // 3. Stored category slug matches catalog slug  e.g. toSlug("Machinery") === "machinery"
  // 4. Substring/prefix matching between slugs
  const categoryProducts = useMemo(() => {
    return combinedProducts.filter((p) => {
      const storedSlug = toSlug(p.category);
      const catSlug = cat.slug;
      return (
        p.category === cat.name ||
        storedSlug === category ||
        storedSlug === catSlug ||
        catSlug.startsWith(storedSlug) ||
        storedSlug.startsWith(catSlug) ||
        catSlug.includes(storedSlug) ||
        storedSlug.includes(catSlug)
      );
    });
  }, [combinedProducts, cat, category]);

  // Derived filter options from actual products
  const uniqueSuppliers = useMemo(() =>
    [...new Set(categoryProducts.map((p) => p.supplier).filter(Boolean))].sort(),
    [categoryProducts]
  );

  const toggle = (arr: string[], v: string, setter: (x: string[]) => void) =>
    setter(arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);

  const filtered = useMemo(() => {
    return categoryProducts.filter((p) => {
      if (search && !p.name.toLowerCase().includes(search.toLowerCase()) &&
          !p.supplier.toLowerCase().includes(search.toLowerCase())) return false;
      if (supplierFilter.length && !supplierFilter.includes(p.supplier)) return false;
      if (leadFilter.length) {
        const bucket = bucketLeadTime(p.leadTime);
        if (!leadFilter.includes(bucket)) return false;
      }
      return true;
    });
  }, [categoryProducts, search, supplierFilter, leadFilter]);

  const clearAll = () => {
    setSupplierFilter([]);
    setLeadFilter([]);
    setSearch("");
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <nav className="mb-4 text-xs text-mutedink">
        <Link to="/" className="hover:text-navy">Home</Link> <span className="mx-1">/</span>
        <Link to="/products/$category" params={{ category: "tiles-flooring" }} className="hover:text-navy">Products</Link> <span className="mx-1">/</span>
        <span className="text-navy">{cat.name}</span>
      </nav>
      <h1 className="font-display text-3xl font-extrabold text-navy sm:text-4xl">{cat.name}</h1>
      <p className="mt-2 text-sm text-mutedink">
        <span className="font-mono-data text-charcoal">{isLoading ? "…" : categoryProducts.length}</span> published products
      </p>

      {/* Category selector navigation tabs */}
      <div className="mt-6 flex flex-wrap gap-2 border-b border-border pb-4">
        {CATEGORIES.map((c) => {
          const isActive = c.slug === cat.slug;
          return (
            <Link
              key={c.slug}
              to="/products/$category"
              params={{ category: c.slug }}
              className={`rounded-full px-4 py-2 text-xs font-semibold transition-colors ${
                isActive
                  ? "bg-navy text-white shadow-sm"
                  : "bg-secondary text-charcoal hover:bg-navy/10 hover:text-navy"
              }`}
            >
              {c.name}
            </Link>
          );
        })}
      </div>

      <div className="mt-10 grid gap-10 lg:grid-cols-[260px_1fr]">
        {/* Filters sidebar */}
        <aside className="space-y-6 self-start lg:sticky lg:top-20">
          {/* Search */}
          <div>
            <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-navy">Search</div>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Product or supplier…"
              className="w-full rounded-md border border-input bg-white px-3 py-2 text-sm outline-none focus:border-ocean"
            />
          </div>

          {/* Supplier filter */}
          {uniqueSuppliers.length > 0 && (
            <div>
              <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-navy">Supplier</div>
              <div className="space-y-1.5">
                {uniqueSuppliers.map((s) => (
                  <CheckRow key={s} label={s} checked={supplierFilter.includes(s)} onChange={() => toggle(supplierFilter, s, setSupplierFilter)} />
                ))}
              </div>
            </div>
          )}

          {/* Lead time filter */}
          <div>
            <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-navy">Lead Time</div>
            <div className="space-y-1.5">
              {LEAD_BUCKETS.map((l) => (
                <CheckRow key={l} label={l} checked={leadFilter.includes(l)} onChange={() => toggle(leadFilter, l, setLeadFilter)} />
              ))}
            </div>
          </div>

          <button onClick={clearAll} className="text-sm font-semibold text-ocean hover:text-navy">Clear All Filters</button>
        </aside>

        {/* Product grid */}
        <div>
          <div className="mb-5 flex items-center justify-between">
            <div className="text-sm text-mutedink">
              Showing <span className="font-mono-data text-navy">{filtered.length}</span> of{" "}
              <span className="font-mono-data text-navy">{categoryProducts.length}</span> results
            </div>
          </div>

          {isLoading ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-white py-24 text-center">
              <Loader2 className="h-8 w-8 animate-spin text-navy/40" />
              <p className="mt-4 text-sm text-mutedink">Loading products…</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-white p-10 text-center text-sm text-mutedink">
              {categoryProducts.length === 0
                ? <>No products published in this category yet. <Link to="/admin" className="font-semibold text-ocean">Upload a catalogue →</Link></>
                : <>No products match these filters. <button onClick={clearAll} className="font-semibold text-ocean">Clear filters</button></>
              }
            </div>
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {filtered.map((p) => <ProductCard key={p.id} p={p} />)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Shared sub-components ─────────────────────────────────────────────────────

function CheckRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: () => void }) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-sm text-charcoal">
      <input type="checkbox" checked={checked} onChange={onChange} className="h-4 w-4 accent-[#0D3B6E]" />
      <span>{label}</span>
    </label>
  );
}

function ProductCard({ p }: { p: DbProduct }) {
  const { add, has } = useEnquiry();
  const added = has(String(p.id));

  // Use the real uploaded image if available, otherwise fall back to a deterministic placeholder
  const image = p.imageUrl
    ? `${API_BASE}${p.imageUrl}`
    : `https://picsum.photos/seed/prod-${p.id}/900/600`;

  return (
    <div className="group flex flex-col overflow-hidden rounded-xl border border-border bg-white transition-all hover:-translate-y-1 hover:shadow-xl hover:shadow-navy/5">
      <div className="aspect-[16/10] overflow-hidden bg-secondary">
        <img src={image} alt={p.name} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex items-center justify-between gap-2">
          <span className="rounded-full bg-secondary px-2 py-0.5 text-xs truncate max-w-[55%]">{p.supplier || "Supplier"}</span>
          <span className="rounded-full bg-green/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-green">Published</span>
        </div>
        <p className="font-display text-base font-bold text-navy line-clamp-2">{p.name}</p>
        <div className="mt-1 flex items-center gap-1.5 text-sm">
          <span className="font-mono-data font-semibold text-navy">{p.fobPrice || "POA"}</span>
          <span className="text-xs text-mutedink">(FOB)</span>
          <span title="Free on Board: price excludes freight & duties">
            <Info className="h-3.5 w-3.5 text-mutedink" />
          </span>
        </div>
        {p.leadTime && (
          <div>
            <span className="inline-flex items-center rounded-md bg-ocean/15 px-2 py-0.5 font-mono-data text-xs text-navy">
              ⏱ {p.leadTime}
            </span>
          </div>
        )}
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Link
            to="/admin"
            search={{ tab: "catalogue" } as never}
            className="rounded-md bg-navy py-2 text-center text-xs font-semibold text-white hover:bg-[#1A5491]"
          >
            View Details
          </Link>
          <button
            onClick={() => add({ id: String(p.id), name: p.name, spec: p.category, origin: p.supplier, image })}
            disabled={added}
            className={`rounded-md border py-2 text-xs font-semibold transition-colors ${
              added ? "border-green bg-green text-white" : "border-navy text-navy hover:bg-navy hover:text-white"
            }`}
          >
            {added ? (<span className="inline-flex items-center gap-1"><Check className="h-3 w-3" /> Added</span>) : "+ Add to Enquiry"}
          </button>
        </div>
      </div>
    </div>
  );
}
