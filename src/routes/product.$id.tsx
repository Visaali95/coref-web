import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useState } from "react";
import { Check, MessageCircle, ShieldCheck, Award } from "lucide-react";
import { getProduct, PRODUCTS } from "@/lib/catalog";
import { useEnquiry } from "@/lib/enquiry";

export const Route = createFileRoute("/product/$id")({
  head: ({ params }) => {
    const p = getProduct(params.id);
    return {
      meta: [
        { title: p ? `${p.name} — Coref` : "Product — Coref" },
        { name: "description", content: p ? `${p.name} from ${p.supplier}. ${p.size}mm ${p.finish} ${p.material}. Request a quote via Coref.` : "Product detail." },
        ...(p ? [{ property: "og:image", content: p.image }] : []),
      ],
    };
  },
  notFoundComponent: () => <div className="p-10 text-center">Product not found.</div>,
  loader: ({ params }) => {
    const p = getProduct(params.id);
    if (!p) throw notFound();
    return { product: p };
  },
  component: ProductPage,
});

const VARIANTS = [
  { name: "White Marble", color: "#EDEAE3" },
  { name: "Grey Veins", color: "#A9B1B5" },
  { name: "Beige", color: "#C9B79A" },
  { name: "Dark Nero", color: "#2A2A2A" },
];

const CITIES = ["Mumbai", "Delhi", "Chennai", "Bangalore", "Hyderabad", "Pune", "Other"];

function ProductPage() {
  const { product: p } = Route.useLoaderData() as { product: NonNullable<ReturnType<typeof getProduct>> };
  const { add, has } = useEnquiry();
  const added = has(p.id);

  const [imgIdx, setImgIdx] = useState(0);
  const [variant, setVariant] = useState(0);

  const [qty, setQty] = useState(500);
  const [city, setCity] = useState("Mumbai");
  const [loading, setLoading] = useState(false);
  const [estimate, setEstimate] = useState<null | { fob: number; freight: number; duty: number; cfs: number; inland: number; total: number }>(null);

  const calc = () => {
    setLoading(true);
    setEstimate(null);
    setTimeout(() => {
      const fob = qty * ((p.priceMin + p.priceMax) / 2);
      const freight = qty * 6;
      const duty = fob * 0.2;
      const cfs = qty * 2.5;
      const inland = qty * 3 + (city === "Other" ? 2000 : 0);
      const total = fob + freight + duty + cfs + inland;
      setEstimate({ fob, freight, duty, cfs, inland, total });
      setLoading(false);
    }, 800);
  };

  const related = PRODUCTS.filter((x) => x.id !== p.id).slice(0, 4);

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <nav className="mb-4 text-xs text-mutedink">
        <Link to="/" className="hover:text-navy">Home</Link> /{" "}
        <Link to="/products/$category" params={{ category: p.categorySlug }} className="hover:text-navy">{p.category}</Link> /{" "}
        <span className="text-navy">{p.name}</span>
      </nav>

      <div className="grid gap-10 lg:grid-cols-[1.4fr_1fr]">
        {/* Gallery */}
        <div>
          <div className="aspect-[4/3] overflow-hidden rounded-2xl bg-secondary">
            <img src={p.gallery[imgIdx]} alt={p.name} className="h-full w-full object-cover" />
          </div>
          <div className="mt-3 grid grid-cols-4 gap-3">
            {p.gallery.map((g: string, i: number) => (
              <button key={i} onClick={() => setImgIdx(i)} className={`aspect-square overflow-hidden rounded-md border-2 ${i === imgIdx ? "border-ocean" : "border-transparent"}`}>
                <img src={g} alt="" className="h-full w-full object-cover" />
              </button>
            ))}
          </div>
          <div className="mt-2 text-center font-mono-data text-xs uppercase tracking-wider text-mutedink">View in Room</div>
        </div>

        {/* Info */}
        <div>
          <Link to="/suppliers/$id" params={{ id: p.supplierSlug }} className="inline-flex items-center gap-2 rounded-full border border-border bg-white px-3 py-1.5 text-xs hover:border-ocean">
            <span className="grid h-5 w-5 place-items-center rounded-full bg-green text-white">
              <Check className="h-3 w-3" />
            </span>
            <span className="font-semibold text-navy">{p.supplier}</span>
            <span className="text-mutedink">· Verified Supplier</span>
          </Link>

          <h1 className="mt-4 font-display text-3xl font-extrabold text-navy">{p.name}</h1>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {[`${p.size}mm`, p.finish, p.material, "Grade A"].map((t) => (
              <span key={t} className="rounded-md bg-secondary px-2 py-0.5 font-mono-data text-xs text-navy">{t}</span>
            ))}
          </div>

          <div className="mt-6 rounded-xl border border-border bg-white p-5">
            <div className="font-mono-data text-2xl font-semibold text-navy">₹{p.priceMin}–{p.priceMax} <span className="text-sm font-normal text-mutedink">/ {p.unit} (FOB Guangzhou)</span></div>
            <div className="mt-1 text-xs text-mutedink">Landed cost estimate available below</div>
            <div className="mt-4 grid grid-cols-3 gap-3 border-t border-border pt-4 text-xs">
              <div><div className="text-mutedink">Lead time</div><div className="mt-0.5 font-mono-data font-semibold text-navy">{p.leadTime}</div></div>
              <div><div className="text-mutedink">MOQ</div><div className="mt-0.5 font-mono-data font-semibold text-navy">{p.moq} sqm</div></div>
              <div><div className="text-mutedink">Origin</div><div className="mt-0.5 font-semibold text-navy">{p.originFlag} {p.origin}</div></div>
            </div>
          </div>

          {/* Sticky actions */}
          <div className="mt-5 space-y-2">
            <Link to="/enquiry" className="block w-full rounded-md bg-navy px-4 py-3 text-center text-sm font-semibold text-white hover:bg-[#1A5491]">Request a Quote</Link>
            <Link to="/enquiry" className="block w-full rounded-md border border-navy px-4 py-3 text-center text-sm font-semibold text-navy hover:bg-navy hover:text-white">Request a Sample</Link>
            <button
              onClick={() => add({ id: p.id, name: p.name, spec: `${p.size} · ${p.finish}`, origin: p.origin, image: p.image })}
              disabled={added}
              className={`block w-full rounded-md border px-4 py-3 text-center text-sm font-semibold transition-colors ${added ? "border-green bg-green text-white" : "border-navy text-navy hover:bg-navy hover:text-white"}`}
            >
              {added ? "✓ Added to Enquiry List" : "+ Add to Enquiry List"}
            </button>
            <a href="https://wa.me/919820012000" target="_blank" rel="noreferrer" className="flex w-full items-center justify-center gap-2 rounded-md bg-green px-4 py-3 text-sm font-semibold text-white hover:bg-[#266f30]">
              <MessageCircle className="h-4 w-4" /> Chat on WhatsApp
            </a>
          </div>

          {/* Variants */}
          <div className="mt-6">
            <div className="text-xs font-semibold uppercase tracking-wider text-navy">Available Variants</div>
            <div className="mt-3 flex gap-3">
              {VARIANTS.map((v, i) => (
                <button
                  key={v.name}
                  onClick={() => { setVariant(i); setImgIdx(i % p.gallery.length); }}
                  className={`group flex flex-col items-center gap-1 ${i === variant ? "" : "opacity-70 hover:opacity-100"}`}
                >
                  <span className={`h-10 w-10 rounded-full border-2 ${i === variant ? "border-ocean" : "border-border"}`} style={{ background: v.color }} />
                  <span className="text-[10px] text-mutedink">{v.name}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Landed Cost Estimator */}
      <section className="mt-16 rounded-2xl border border-border bg-white p-6 sm:p-8">
        <h2 className="font-display text-2xl font-extrabold text-navy">Estimate your landed cost</h2>
        <div className="mt-5 grid gap-4 sm:grid-cols-[1fr_1fr_auto]">
          <label className="block">
            <span className="block text-xs font-semibold uppercase tracking-wider text-mutedink">Quantity (sqm)</span>
            <input type="number" value={qty} onChange={(e) => setQty(+e.target.value || 0)} className="mt-1 w-full rounded-md border border-input bg-offwhite px-3 py-2 font-mono-data text-navy" />
          </label>
          <label className="block">
            <span className="block text-xs font-semibold uppercase tracking-wider text-mutedink">Destination city</span>
            <select value={city} onChange={(e) => setCity(e.target.value)} className="mt-1 w-full rounded-md border border-input bg-offwhite px-3 py-2 text-navy">
              {CITIES.map((c) => <option key={c}>{c}</option>)}
            </select>
          </label>
          <button onClick={calc} className="self-end rounded-md bg-ocean px-5 py-2.5 text-sm font-semibold text-navy hover:bg-[#7fc1e3]">Calculate Estimate</button>
        </div>

        {(loading || estimate) && (
          <div className="mt-6 overflow-hidden rounded-lg border border-border">
            <table className="w-full text-sm">
              <tbody className="font-mono-data">
                {loading
                  ? [...Array(5)].map((_, i) => (
                      <tr key={i} className="border-b border-border last:border-0">
                        <td className="px-4 py-3"><div className="h-3 w-32 animate-pulse rounded bg-secondary" /></td>
                        <td className="px-4 py-3 text-right"><div className="ml-auto h-3 w-20 animate-pulse rounded bg-secondary" /></td>
                      </tr>
                    ))
                  : estimate && (
                    <>
                      <Row k="FOB Price" v={estimate.fob} />
                      <Row k="Sea Freight" v={estimate.freight} />
                      <Row k="Customs & Duties (~20%)" v={estimate.duty} />
                      <Row k="CFS / Port Handling" v={estimate.cfs} />
                      <Row k="Inland Transport" v={estimate.inland} />
                      <tr className="bg-navy text-white">
                        <td className="px-4 py-3 font-display font-bold">Total Estimated Landed Cost</td>
                        <td className="px-4 py-3 text-right font-display text-lg font-extrabold">₹{Math.round(estimate.total).toLocaleString("en-IN")}</td>
                      </tr>
                    </>
                  )}
              </tbody>
            </table>
          </div>
        )}
        {estimate && (
          <div className="mt-3 rounded-md bg-green/10 px-4 py-2 text-xs text-green">
            This estimate is indicative. Exact quote provided within 24 hours.
          </div>
        )}
      </section>

      {/* Specs */}
      <section className="mt-12 grid gap-8 lg:grid-cols-[2fr_1fr]">
        <div>
          <h2 className="font-display text-2xl font-extrabold text-navy">Technical Specifications</h2>
          <div className="mt-4 overflow-hidden rounded-xl border border-border bg-white">
            <table className="w-full text-sm">
              <tbody>
                {[
                  ["Material", p.material],
                  ["Surface Finish", p.finish],
                  ["Edge Type", "Rectified"],
                  ["Water Absorption", "< 0.5%"],
                  ["Slip Resistance", "R10"],
                  ["Breaking Strength", "≥ 1300 N"],
                  ["Frost Resistance", "Yes"],
                  ["Packaging", "2 pcs / box · 1.44 sqm / box"],
                  ["Container Fill", "560 sqm (20ft) · 1,120 sqm (40ft)"],
                ].map(([k, v]) => (
                  <tr key={k} className="border-b border-border last:border-0">
                    <td className="w-1/2 bg-offwhite px-4 py-3 text-xs uppercase tracking-wider text-mutedink">{k}</td>
                    <td className="px-4 py-3 font-mono-data text-navy">{v}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div>
          <h2 className="font-display text-2xl font-extrabold text-navy">Certifications</h2>
          <div className="mt-4 grid grid-cols-3 gap-3">
            {[
              { i: ShieldCheck, l: "CE" },
              { i: Award, l: "ISO 9001" },
              { i: ShieldCheck, l: "Bureau Veritas" },
            ].map((c) => (
              <div key={c.l} className="flex flex-col items-center gap-2 rounded-lg border border-border bg-white p-4">
                <c.i className="h-7 w-7 text-ocean" />
                <div className="text-xs font-semibold text-navy">{c.l}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Related */}
      <section className="mt-16">
        <h2 className="mb-5 font-display text-2xl font-extrabold text-navy">Related products</h2>
        <div className="-mx-4 flex gap-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
          {related.map((r) => (
            <Link
              key={r.id}
              to="/product/$id"
              params={{ id: r.slug }}
              className="group min-w-[240px] max-w-[260px] flex-1 overflow-hidden rounded-xl border border-border bg-white"
            >
              <div className="aspect-[4/3] overflow-hidden bg-secondary">
                <img src={r.image} alt={r.name} className="h-full w-full object-cover transition-transform group-hover:scale-105" />
              </div>
              <div className="p-3">
                <div className="font-display text-sm font-bold text-navy">{r.name}</div>
                <div className="mt-0.5 font-mono-data text-xs text-mutedink">₹{r.priceMin}–{r.priceMax} / {r.unit} (FOB)</div>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}

function Row({ k, v }: { k: string; v: number }) {
  return (
    <tr className="border-b border-border">
      <td className="px-4 py-3 text-charcoal">{k}</td>
      <td className="px-4 py-3 text-right text-navy">₹{Math.round(v).toLocaleString("en-IN")}</td>
    </tr>
  );
}
