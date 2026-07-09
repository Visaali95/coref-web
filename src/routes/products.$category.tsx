import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Info, Check } from "lucide-react";
import { productsByCategory, getCategory, CATEGORIES, type Product } from "@/lib/catalog";
import { useEnquiry } from "@/lib/enquiry";

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

const TYPES = ["Porcelain", "Ceramic", "Marble", "Mosaic", "Travertine", "Vitrified"];
const ORIGINS: Array<{ name: string; flag: string }> = [
  { name: "China", flag: "🇨🇳" },
  { name: "Italy", flag: "🇮🇹" },
  { name: "Turkey", flag: "🇹🇷" },
  { name: "Spain", flag: "🇪🇸" },
  { name: "India", flag: "🇮🇳" },
];
const SIZES = ["600×600", "600×1200", "800×800", "Custom"];
const FINISHES = ["Matt", "Glossy", "Satin", "Textured"];
const LEAD = ["Under 4 weeks", "4–8 weeks", "8–12 weeks"];

function CategoryPage() {
  const { category } = Route.useParams();
  const cat = getCategory(category) ?? CATEGORIES[0];
  const all = productsByCategory(cat.slug);

  const [types, setTypes] = useState<string[]>([]);
  const [origins, setOrigins] = useState<string[]>([]);
  const [sizes, setSizes] = useState<string[]>([]);
  const [finishes, setFinishes] = useState<string[]>([]);
  const [leads, setLeads] = useState<string[]>([]);
  const [sampleOnly, setSampleOnly] = useState(false);
  const [inspOnly, setInspOnly] = useState(false);
  const [moq, setMoq] = useState(5000);

  const toggle = (arr: string[], v: string, setter: (x: string[]) => void) =>
    setter(arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);

  const filtered = useMemo(
    () =>
      all.filter((p) => {
        if (types.length && !types.includes(p.type)) return false;
        if (origins.length && !origins.includes(p.origin)) return false;
        if (sizes.length && !sizes.includes(p.size)) return false;
        if (finishes.length && !finishes.includes(p.finish)) return false;
        if (leads.length && !leads.includes(p.leadTime)) return false;
        if (sampleOnly && !p.sample) return false;
        if (inspOnly && !p.inspection) return false;
        if (p.moq > moq) return false;
        return true;
      }),
    [all, types, origins, sizes, finishes, leads, sampleOnly, inspOnly, moq],
  );

  const clearAll = () => {
    setTypes([]); setOrigins([]); setSizes([]); setFinishes([]); setLeads([]);
    setSampleOnly(false); setInspOnly(false); setMoq(5000);
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <nav className="mb-4 text-xs text-mutedink">
        <Link to="/" className="hover:text-navy">Home</Link> <span className="mx-1">/</span>
        <Link to="/products/tiles-flooring" className="hover:text-navy">Products</Link> <span className="mx-1">/</span>
        <span className="text-navy">{cat.name}</span>
      </nav>
      <h1 className="font-display text-3xl font-extrabold text-navy sm:text-4xl">{cat.name}</h1>
      <p className="mt-2 text-sm text-mutedink">
        <span className="font-mono-data text-charcoal">{cat.count}</span> products from{" "}
        <span className="font-mono-data text-charcoal">68</span> verified suppliers
      </p>

      <div className="mt-10 grid gap-10 lg:grid-cols-[260px_1fr]">
        {/* Filters */}
        <aside className="space-y-6 self-start lg:sticky lg:top-20">
          <FilterSection title="Product Type">
            {TYPES.map((t) => (
              <CheckRow key={t} label={t} checked={types.includes(t)} onChange={() => toggle(types, t, setTypes)} />
            ))}
          </FilterSection>

          <FilterSection title="Origin">
            {ORIGINS.map((o) => (
              <CheckRow
                key={o.name}
                label={<><span className="mr-1.5">{o.flag}</span>{o.name}</>}
                checked={origins.includes(o.name)}
                onChange={() => toggle(origins, o.name, setOrigins)}
              />
            ))}
          </FilterSection>

          <FilterSection title="Size">
            {SIZES.map((s) => (
              <CheckRow key={s} label={<span className="font-mono-data">{s}</span>} checked={sizes.includes(s)} onChange={() => toggle(sizes, s, setSizes)} />
            ))}
          </FilterSection>

          <FilterSection title="Finish">
            {FINISHES.map((f) => (
              <CheckRow key={f} label={f} checked={finishes.includes(f)} onChange={() => toggle(finishes, f, setFinishes)} />
            ))}
          </FilterSection>

          <FilterSection title="Max MOQ">
            <div className="font-mono-data text-xs text-mutedink">Up to {moq.toLocaleString()} sqm</div>
            <input type="range" min={50} max={5000} step={50} value={moq} onChange={(e) => setMoq(+e.target.value)} className="mt-2 w-full accent-[#0D3B6E]" />
          </FilterSection>

          <FilterSection title="Lead Time">
            {LEAD.map((l) => (
              <CheckRow key={l} label={l} checked={leads.includes(l)} onChange={() => toggle(leads, l, setLeads)} />
            ))}
          </FilterSection>

          <div className="space-y-2">
            <ToggleRow label="Sample Available" checked={sampleOnly} onChange={setSampleOnly} />
            <ToggleRow label="Inspection Report" checked={inspOnly} onChange={setInspOnly} />
          </div>

          <button onClick={clearAll} className="text-sm font-semibold text-ocean hover:text-navy">Clear All Filters</button>
        </aside>

        {/* Grid */}
        <div>
          <div className="mb-5 flex items-center justify-between">
            <div className="text-sm text-mutedink">
              Showing <span className="font-mono-data text-navy">{filtered.length}</span> of{" "}
              <span className="font-mono-data text-navy">{all.length}</span> results
            </div>
            <select className="rounded-md border border-input bg-white px-3 py-1.5 text-xs">
              <option>Sort: Recommended</option>
              <option>Lead time (shortest)</option>
              <option>Price (low → high)</option>
              <option>MOQ (low → high)</option>
            </select>
          </div>
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {filtered.map((p) => <ProductCard key={p.id} p={p} />)}
          </div>
          {filtered.length === 0 && (
            <div className="rounded-xl border border-dashed border-border bg-white p-10 text-center text-sm text-mutedink">
              No products match these filters. <button onClick={clearAll} className="font-semibold text-ocean">Clear filters</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function FilterSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-navy">{title}</div>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

function CheckRow({ label, checked, onChange }: { label: React.ReactNode; checked: boolean; onChange: () => void }) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-sm text-charcoal">
      <input type="checkbox" checked={checked} onChange={onChange} className="h-4 w-4 accent-[#0D3B6E]" />
      <span>{label}</span>
    </label>
  );
}

function ToggleRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: (b: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center justify-between text-sm text-charcoal">
      <span>{label}</span>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={`relative h-5 w-9 rounded-full transition-colors ${checked ? "bg-green" : "bg-border"}`}
      >
        <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${checked ? "translate-x-4" : "translate-x-0.5"}`} />
      </button>
    </label>
  );
}

function ProductCard({ p }: { p: Product }) {
  const { add, has } = useEnquiry();
  const added = has(p.id);
  return (
    <div className="group flex flex-col overflow-hidden rounded-xl border border-border bg-white transition-all hover:-translate-y-1 hover:shadow-xl hover:shadow-navy/5">
      <div className="aspect-[16/10] overflow-hidden bg-secondary">
        <img src={p.image} alt={p.name} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex items-center justify-between gap-2">
          <span className="rounded-full bg-secondary px-2 py-0.5 text-xs">{p.originFlag} {p.origin}</span>
          {p.sample
            ? <span className="rounded-full bg-green/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-green">Sample Available</span>
            : <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-mutedink">No Sample</span>}
        </div>
        <Link to="/product/$id" params={{ id: p.slug }} className="font-display text-base font-bold text-navy hover:text-ocean">
          {p.name}
        </Link>
        <div className="font-mono-data text-xs text-mutedink">{p.size}mm · {p.finish} · {p.material}</div>
        <div className="mt-1 flex items-center gap-1.5 text-sm">
          <span className="font-mono-data font-semibold text-navy">₹{p.priceMin}–{p.priceMax} / {p.unit}</span>
          <span className="text-xs text-mutedink">(FOB)</span>
          <span title="Free on Board: price excludes freight & duties"><Info className="h-3.5 w-3.5 text-mutedink" /></span>
        </div>
        <div className="mt-1">
          <span className="inline-flex items-center rounded-md bg-ocean/15 px-2 py-0.5 font-mono-data text-xs text-navy">⏱ {p.leadTime}</span>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Link to="/product/$id" params={{ id: p.slug }} className="rounded-md bg-navy py-2 text-center text-xs font-semibold text-white hover:bg-[#1A5491]">
            View Details
          </Link>
          <button
            onClick={() => add({ id: p.id, name: p.name, spec: `${p.size} · ${p.finish}`, origin: p.origin, image: p.image })}
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
