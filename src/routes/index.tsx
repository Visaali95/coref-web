import { createFileRoute, Link } from "@tanstack/react-router";
import { useRef, useState } from "react";
import {
  ArrowRight, Upload, FileSpreadsheet, Factory, Truck, ShieldCheck,
  CheckCircle2, Boxes, Search, FileCheck, MapPin, Layers,
  ChevronLeft, ChevronRight, Check,
} from "lucide-react";
import { CATEGORIES } from "@/lib/catalog";
import { useEnquiry } from "@/lib/enquiry";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Coref — China's factories, at your doorstep." },
      { name: "description", content: "Coref gives architects, builders and businesses direct access to vetted Chinese manufacturers — and handles freight, customs and last-mile delivery." },
      { property: "og:title", content: "Coref — China's factories, at your doorstep." },
      { property: "og:description", content: "Factory-direct sourcing from China with end-to-end logistics into India." },
    ],
  }),
  component: HomePage,
});

const personas = {
  architects: {
    label: "For Architects",
    features: [
      { icon: Upload, title: "Upload BOQ", desc: "Bill of quantities reviewed within 2 hours" },
      { icon: FileSpreadsheet, title: "Upload Drawings", desc: "Share DWG, PDF, or spec sheets" },
      { icon: Search, title: "Sourcing Options", desc: "2–4 pre-vetted Chinese suppliers per line item" },
      { icon: Boxes, title: "Request Samples", desc: "Physical samples delivered to your office" },
      { icon: MapPin, title: "Track Procurement", desc: "Live status from PO to site delivery" },
    ],
  },
  machinery: {
    label: "For Machinery Buyers",
    features: [
      { icon: Upload, title: "Upload Machine Spec", desc: "Share machine specifications or RFQ" },
      { icon: Factory, title: "Factory Matches", desc: "Vetted Chinese manufacturers" },
      { icon: Layers, title: "Compare Suppliers", desc: "Side-by-side capacity and pricing" },
      { icon: FileCheck, title: "Inspection Reports", desc: "Third-party QC before payment" },
      { icon: Truck, title: "Track Shipment", desc: "Container-level visibility to port" },
    ],
  },
  businesses: {
    label: "For Businesses",
    features: [
      { icon: FileSpreadsheet, title: "Landed Cost Estimates", desc: "Indicative total before you commit" },
      { icon: Truck, title: "Container Status", desc: "Real-time tracking across ocean & inland" },
      { icon: FileCheck, title: "Download Documents", desc: "Invoices, BL, COO, fumigation in one place" },
      { icon: Layers, title: "Multiple Projects", desc: "Manage parallel orders from one dashboard" },
    ],
  },
} as const;

type PersonaKey = keyof typeof personas;

type Featured = {
  id: string; name: string; spec: string; price: string;
  origin: string; lead: string; img: string; tag: "trending" | "new";
};

const FEATURED: Featured[] = [
  { id: "f1", name: "Italian Marble Look Porcelain Tile", spec: "600×1200mm · Matt · Porcelain", price: "₹58–72 / sqm (FOB)", origin: "Guangdong", lead: "6–8 weeks", img: "https://picsum.photos/seed/featuretile/600/450", tag: "trending" },
  { id: "f2", name: "Matte Black Basin Mixer Tap", spec: "Brass · Single Lever · Matt Black", price: "₹3,200–4,800 / unit (FOB)", origin: "Wenzhou", lead: "5–7 weeks", img: "https://picsum.photos/seed/mixer/600/450", tag: "trending" },
  { id: "f3", name: "CNC Laser Cutting Machine 1325", spec: "1500W Fiber · 1300×2500mm bed", price: "₹4.2L–5.8L / unit (FOB)", origin: "Jinan", lead: "10–12 weeks", img: "https://picsum.photos/seed/cnc/600/450", tag: "trending" },
  { id: "f4", name: "Terrazzo Cement Floor Tile", spec: "300×300mm · Honed · Cement", price: "₹85–110 / sqm (FOB)", origin: "Foshan", lead: "6–8 weeks", img: "https://picsum.photos/seed/terrazzo/600/450", tag: "new" },
  { id: "f5", name: "LED Recessed Panel Light 60×60", spec: "36W · 3000K/4000K · 100lm/W", price: "₹680–920 / unit (FOB)", origin: "Shenzhen", lead: "4–6 weeks", img: "https://picsum.photos/seed/panel/600/450", tag: "new" },
  { id: "f6", name: "Galvanised Steel C-Purlin", spec: "200×75mm · 2.5mm · Hot-Dip Galv.", price: "₹62–78 / kg (FOB)", origin: "Tianjin", lead: "6–8 weeks", img: "https://picsum.photos/seed/purlin/600/450", tag: "new" },
];

function HomePage() {
  const [persona, setPersona] = useState<PersonaKey>("architects");
  const active = personas[persona];
  const [featTab, setFeatTab] = useState<"trending" | "new">("trending");
  const carouselRef = useRef<HTMLDivElement>(null);
  const { add, has } = useEnquiry();

  const steps = [
    { n: "01", icon: Upload, title: "Share Your Requirement", desc: "Upload BOQ, spec sheet, or architectural drawing." },
    { n: "02", icon: Factory, title: "Coref Matches Chinese Factories", desc: "Vetted, quality-checked, ranked by fit." },
    { n: "03", icon: FileCheck, title: "Get Quotes + Samples", desc: "Itemised quotes with landed cost estimates." },
    { n: "04", icon: ShieldCheck, title: "Place Your Order", desc: "Coref manages PO, QC, and export paperwork from China." },
    { n: "05", icon: Truck, title: "We Handle Logistics", desc: "Sea freight, customs clearance, last-mile India delivery." },
  ];

  const scrollCarousel = (dir: 1 | -1) => {
    const el = carouselRef.current;
    if (!el) return;
    const card = el.querySelector<HTMLElement>("[data-card]");
    const step = card ? card.offsetWidth + 20 : 320;
    el.scrollBy({ left: dir * step, behavior: "smooth" });
  };

  const filteredFeatured = FEATURED.filter((p) => p.tag === featTab);

  return (
    <>
      {/* HERO */}
      <section className="relative overflow-hidden hero-gradient text-white">
        <div className="absolute inset-0 grid-overlay opacity-60" />
        <Link
          to="/admin"
          className="absolute right-4 top-4 z-10 hidden items-center gap-1.5 rounded-full border border-white/25 bg-white/5 px-3 py-1.5 font-mono-data text-[10px] uppercase tracking-[0.18em] text-white/70 backdrop-blur hover:border-white/50 hover:text-white sm:inline-flex"
        >
          Admin Panel →
        </Link>
        <div className="relative mx-auto grid max-w-7xl gap-12 px-4 py-20 sm:px-6 lg:grid-cols-5 lg:py-28">
          <div className="lg:col-span-3">
            <div className="mb-5 font-mono-data text-xs uppercase tracking-[0.25em] text-ocean">
              Factory-Direct from China · Door-to-Door Logistics
            </div>
            <h1 className="font-display text-5xl font-extrabold leading-[1.05] tracking-tight sm:text-6xl">
              China's factories,
              <br />
              <span className="text-ocean">at your doorstep.</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg text-white/80">
              Coref gives architects, builders, and businesses direct access to vetted Chinese manufacturers — and handles freight, customs, and last-mile delivery so you don't have to.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/enquiry" className="rounded-md bg-white px-6 py-3 text-sm font-semibold text-navy transition-transform hover:-translate-y-0.5">
                Start a Sourcing Request
              </Link>
              <Link to="/products/$category" params={{ category: "tiles-flooring" }} className="rounded-md border border-white/40 px-6 py-3 text-sm font-semibold text-white hover:bg-white/10">
                Browse Products
              </Link>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 self-center lg:col-span-2">
            {[
              { n: "500+", l: "Chinese factories vetted", r: "-rotate-1" },
              { n: "1,200+", l: "Projects delivered to India", r: "rotate-1" },
              { n: "24hr", l: "Quote turnaround", r: "rotate-1" },
              { n: "₹0", l: "Hidden charges", r: "-rotate-1" },
            ].map((s) => (
              <div key={s.l} className={`rounded-xl bg-white p-5 text-navy shadow-xl shadow-black/20 transform ${s.r}`}>
                <div className="font-display text-3xl font-extrabold">{s.n}</div>
                <div className="mt-1 text-xs text-mutedink">{s.l}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CHINA ORIGIN STRIP */}
      <section className="border-y border-border bg-offwhite">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="font-display text-sm font-bold text-navy">We source directly from China's top manufacturing hubs</div>
              <div className="mt-1 text-xs text-mutedink">Factory-direct pricing. No agents. No markups.</div>
            </div>
            <div className="flex flex-wrap gap-2">
              {["Guangdong", "Foshan", "Yiwu", "Shenzhen", "Dongguan", "Hangzhou"].map((c) => (
                <span key={c} className="inline-flex items-center gap-1.5 rounded-full border border-border bg-white px-3 py-1.5 text-xs font-medium text-charcoal">
                  <span>🇨🇳</span>{c}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* PERSONA SELECTOR */}
      <section className="bg-white">
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
          <div className="mb-8 flex flex-wrap gap-2 border-b border-border">
            {(Object.keys(personas) as PersonaKey[]).map((k) => (
              <button
                key={k}
                onClick={() => setPersona(k)}
                className={`relative -mb-px px-4 py-3 text-sm font-semibold transition-colors ${
                  persona === k ? "text-navy" : "text-mutedink hover:text-charcoal"
                }`}
              >
                {personas[k].label}
                {persona === k && <span className="absolute inset-x-0 -bottom-px h-0.5 bg-ocean" />}
              </button>
            ))}
          </div>
          <div key={persona} className="grid animate-in fade-in slide-in-from-bottom-2 duration-300 gap-6 sm:grid-cols-2 lg:grid-cols-5">
            {active.features.map((f) => (
              <div key={f.title} className="rounded-xl border border-border bg-offwhite p-5">
                <div className="grid h-10 w-10 place-items-center rounded-md bg-navy text-white">
                  <f.icon className="h-5 w-5" />
                </div>
                <div className="mt-4 font-display text-base font-bold text-navy">{f.title}</div>
                <div className="mt-1 text-sm text-mutedink">{f.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CATEGORIES */}
      <section className="bg-offwhite">
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
          <div className="mb-10 flex items-end justify-between gap-4">
            <h2 className="font-display text-3xl font-extrabold text-navy sm:text-4xl">Browse by Category</h2>
            <Link to="/products/$category" params={{ category: "tiles-flooring" }} className="hidden text-sm font-semibold text-ocean hover:text-navy sm:inline">View all →</Link>
          </div>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {CATEGORIES.map((c) => (
              <Link
                key={c.slug}
                to="/products/$category"
                params={{ category: c.slug }}
                className="group relative aspect-[4/3] overflow-hidden rounded-xl"
              >
                <img src={c.image} alt={c.name} className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
                <div className="absolute inset-0 bg-gradient-to-tr from-navy/90 via-navy/60 to-navy/30 transition-opacity group-hover:from-navy/80" />
                <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 p-5 text-white">
                  <div>
                    <div className="font-display text-xl font-bold">{c.name}</div>
                    <div className="font-mono-data text-xs text-ocean">{c.count}+ products</div>
                  </div>
                  <ArrowRight className="h-5 w-5 -translate-x-1 transition-transform group-hover:translate-x-0" />
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* FEATURED PRODUCTS */}
      <section className="bg-white">
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
          <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
            <h2 className="font-display text-3xl font-extrabold text-navy sm:text-4xl">Featured Products</h2>
            <Link to="/products/$category" params={{ category: "tiles-flooring" }} className="text-sm font-semibold text-ocean hover:text-navy">View all products →</Link>
          </div>

          <div className="mb-6 inline-flex rounded-full border border-border bg-offwhite p-1">
            {(["trending", "new"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setFeatTab(t)}
                className={`rounded-full px-4 py-1.5 text-xs font-semibold transition-colors ${
                  featTab === t ? "bg-navy text-white" : "text-mutedink hover:text-charcoal"
                }`}
              >
                {t === "trending" ? "Trending" : "New Arrivals"}
              </button>
            ))}
          </div>

          <div className="relative">
            <button
              aria-label="Previous"
              onClick={() => scrollCarousel(-1)}
              className="absolute -left-2 top-1/2 z-10 hidden h-10 w-10 -translate-y-1/2 place-items-center rounded-full border border-border bg-white text-navy shadow-md hover:bg-navy hover:text-white sm:grid"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              aria-label="Next"
              onClick={() => scrollCarousel(1)}
              className="absolute -right-2 top-1/2 z-10 hidden h-10 w-10 -translate-y-1/2 place-items-center rounded-full border border-border bg-white text-navy shadow-md hover:bg-navy hover:text-white sm:grid"
            >
              <ChevronRight className="h-5 w-5" />
            </button>

            <div
              ref={carouselRef}
              className="flex snap-x snap-mandatory gap-5 overflow-x-auto scroll-smooth pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
              {filteredFeatured.map((p) => {
                const added = has(p.id);
                return (
                  <div
                    key={p.id}
                    data-card
                    className="group flex w-[85%] shrink-0 snap-start flex-col overflow-hidden rounded-xl border border-border bg-white transition-all hover:-translate-y-1 hover:shadow-lg sm:w-[calc(50%-10px)] lg:w-[calc(25%-15px)]"
                  >
                    <div className="relative aspect-[4/3] overflow-hidden">
                      <img src={p.img} alt={p.name} className="h-full w-full object-cover" />
                      <span className="absolute left-2 top-2 rounded bg-gold px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
                        Featured
                      </span>
                      <span className="absolute right-2 top-2 inline-flex items-center gap-1 rounded bg-navy/85 px-2 py-0.5 text-[10px] font-semibold text-white backdrop-blur">
                        🇨🇳 Made in China
                      </span>
                    </div>
                    <div className="flex flex-1 flex-col p-4">
                      <div className="line-clamp-2 font-display text-sm font-bold text-navy">{p.name}</div>
                      <div className="mt-1 font-mono-data text-[11px] text-mutedink">{p.spec}</div>
                      <div className="mt-2 text-sm font-semibold text-charcoal">{p.price}</div>
                      <div className="mt-2 inline-flex w-fit items-center rounded bg-ocean/15 px-2 py-0.5 text-[11px] font-medium text-navy">
                        {p.lead} · {p.origin}
                      </div>
                      <div className="mt-4 flex gap-2">
                        <Link
                          to="/product/$id"
                          params={{ id: "p1" }}
                          className="flex-[3] rounded-md bg-navy py-2 text-center text-xs font-semibold text-white hover:bg-[#1A5491]"
                        >
                          View Details
                        </Link>
                        <button
                          onClick={() => add({ id: p.id, name: p.name, spec: p.spec, origin: p.origin, image: p.img })}
                          className={`flex-[2] rounded-md border py-2 text-xs font-semibold transition-colors ${
                            added
                              ? "border-green bg-green text-white"
                              : "border-navy text-navy hover:bg-navy hover:text-white"
                          }`}
                        >
                          {added ? <span className="inline-flex items-center justify-center gap-1"><Check className="h-3.5 w-3.5" />Added</span> : "+ Enquire"}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="bg-navy text-white">
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
          <h2 className="mb-12 font-display text-3xl font-extrabold sm:text-4xl">How Coref works</h2>
          <div className="relative grid gap-8 lg:grid-cols-5">
            <div className="absolute left-0 right-0 top-6 hidden border-t border-dashed border-white/20 lg:block" />
            {steps.map((s) => (
              <div key={s.n} className="relative">
                <div className="relative z-10 grid h-12 w-12 place-items-center rounded-full bg-ocean text-navy">
                  <s.icon className="h-5 w-5" />
                </div>
                <div className="mt-4 font-mono-data text-xs text-ocean">{s.n}</div>
                <div className="mt-1 font-display text-lg font-bold">{s.title}</div>
                <div className="mt-1 text-sm text-white/70">{s.desc}</div>
              </div>
            ))}
          </div>
          <div className="mt-10">
            <Link to="/how-it-works" className="inline-flex items-center gap-1 text-sm font-semibold text-ocean hover:text-white">
              See how it works in detail <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* TRUST */}
      <section className="bg-white">
        <div className="mx-auto grid max-w-7xl gap-12 px-4 py-20 sm:px-6 lg:grid-cols-2">
          <div>
            <h2 className="font-display text-3xl font-extrabold text-navy sm:text-4xl">Why professionals choose Coref</h2>
            <ul className="mt-8 space-y-4">
              {[
                "Factory-direct pricing from China (no middlemen, no agents)",
                "Pre-shipment inspection at Chinese factory",
                "Landed cost transparency before you commit",
                "Single point of contact for procurement + freight",
                "India customs and compliance expertise",
              ].map((t) => (
                <li key={t} className="flex items-start gap-3">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-green" />
                  <span className="text-charcoal">{t}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-2xl border border-border bg-offwhite p-8">
            <div className="font-mono-data text-xs uppercase tracking-wider text-ocean">Client Testimonial</div>
            <blockquote className="mt-4 font-display text-xl leading-snug text-navy">
              "Coref handled 14 containers of Chinese porcelain across 6 projects. Landed cost matched the estimate within 3%. The transparency on freight and customs alone changed how we plan procurement."
            </blockquote>
            <div className="mt-6 flex items-center gap-3">
              <div className="grid h-11 w-11 place-items-center rounded-full bg-navy font-display text-base font-bold text-white">RP</div>
              <div>
                <div className="text-sm font-semibold text-navy">Rohan Patel, Principal Architect</div>
                <div className="text-xs text-mutedink">Studio Linework, Mumbai</div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
