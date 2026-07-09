import { createFileRoute, Link } from "@tanstack/react-router";
import { ShieldCheck, Award, FileText, CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/suppliers/$id")({
  head: ({ params }) => ({
    meta: [
      { title: `Supplier · ${params.id} — Coref` },
      { name: "description", content: "Vetted international supplier profile on Coref." },
    ],
  }),
  component: SupplierPage,
});

const factoryImgs = [
  "https://picsum.photos/seed/fac1/600/400",
  "https://picsum.photos/seed/fac2/600/400",
  "https://picsum.photos/seed/fac3/600/400",
  "https://picsum.photos/seed/fac4/600/400",
  "https://picsum.photos/seed/fac5/600/400",
  "https://picsum.photos/seed/fac6/600/400",
];

function SupplierPage() {
  const { id } = Route.useParams();
  const name = id.split("-").map((w: string) => w[0].toUpperCase() + w.slice(1)).join(" ");

  return (
    <div>
      <header className="bg-navy text-white">
        <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
          <nav className="mb-4 text-xs text-white/60">
            <Link to="/" className="hover:text-white">Home</Link> / Suppliers / <span className="text-white">{name}</span>
          </nav>
          <h1 className="font-display text-4xl font-extrabold">{name}</h1>
          <div className="mt-4 flex flex-wrap gap-2">
            {["Est. 2008", "ISO 9001", "Bureau Veritas Approved"].map((s) => (
              <span key={s} className="rounded-full border border-white/20 bg-white/10 px-3 py-1 font-mono-data text-xs">{s}</span>
            ))}
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[2fr_1fr]">
        <div className="space-y-12">
          <section>
            <h2 className="font-display text-2xl font-extrabold text-navy">About</h2>
            <p className="mt-3 text-charcoal">
              {name} is a Guangdong-based manufacturer producing premium porcelain and ceramic tiles for export. Annual capacity exceeds 8 million sqm across two production lines, with dedicated QC labs and a 22,000 sqm warehouse facility. Coref has worked with them since 2021.
            </p>
          </section>

          <section>
            <h2 className="mb-4 font-display text-2xl font-extrabold text-navy">Factory gallery</h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {factoryImgs.map((src, i) => (
                <div key={i} className="aspect-[4/3] overflow-hidden rounded-lg bg-secondary">
                  <img src={src} alt="" className="h-full w-full object-cover" />
                </div>
              ))}
            </div>
          </section>

          <section>
            <h2 className="mb-4 font-display text-2xl font-extrabold text-navy">Capabilities</h2>
            <div className="grid gap-4 sm:grid-cols-3">
              <Stat label="Annual capacity" value="8M sqm" />
              <Stat label="Product types" value="Porcelain, Ceramic, Mosaic" />
              <Stat label="Min. order" value="200 sqm" />
            </div>
            <div className="mt-5 text-xs font-semibold uppercase tracking-wider text-mutedink">Export markets</div>
            <div className="mt-2 flex flex-wrap gap-2 text-2xl">🇬🇧 🇦🇺 🇮🇳 🇸🇦 🇺🇸 🇦🇪 🇿🇦 🇸🇬</div>
          </section>

          <section>
            <h2 className="mb-4 font-display text-2xl font-extrabold text-navy">QC process</h2>
            <div className="grid gap-3 sm:grid-cols-4">
              {["Raw Material", "Production QC", "Pre-shipment Inspection", "Packaging Audit"].map((s, i) => (
                <div key={s} className="rounded-lg border border-border bg-white p-4">
                  <div className="font-mono-data text-xs text-ocean">Step {i + 1}</div>
                  <div className="mt-1 font-display text-sm font-bold text-navy">{s}</div>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h2 className="mb-4 font-display text-2xl font-extrabold text-navy">Certifications</h2>
            <div className="overflow-hidden rounded-xl border border-border bg-white">
              <table className="w-full text-sm">
                <thead className="bg-offwhite text-xs uppercase tracking-wider text-mutedink">
                  <tr><th className="px-4 py-3 text-left">Certificate</th><th className="px-4 py-3 text-left">Issuing body</th><th className="px-4 py-3 text-left">Valid until</th></tr>
                </thead>
                <tbody>
                  {[
                    ["ISO 9001:2015", "TÜV Rheinland", "Mar 2027"],
                    ["CE Marking", "Notified Body 1922", "Ongoing"],
                    ["Bureau Veritas QC", "Bureau Veritas", "Aug 2026"],
                  ].map(([c, b, v]) => (
                    <tr key={c} className="border-t border-border">
                      <td className="px-4 py-3 font-semibold text-navy">{c}</td>
                      <td className="px-4 py-3 text-charcoal">{b}</td>
                      <td className="px-4 py-3 font-mono-data text-charcoal">{v}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section>
            <h2 className="mb-4 font-display text-2xl font-extrabold text-navy">Coref inspection history</h2>
            <ul className="space-y-3">
              {[
                { d: "Mar 2026", ref: "INS-2026-118", res: "Pass" },
                { d: "Nov 2025", ref: "INS-2025-091", res: "Pass" },
                { d: "Jul 2025", ref: "INS-2025-052", res: "Pass" },
              ].map((i) => (
                <li key={i.ref} className="flex items-center justify-between gap-3 rounded-lg border border-border bg-white p-4">
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="h-5 w-5 text-green" />
                    <div>
                      <div className="font-display text-sm font-bold text-navy">{i.ref}</div>
                      <div className="font-mono-data text-xs text-mutedink">{i.d}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="rounded-full bg-green/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-green">{i.res}</span>
                    <a href="#" className="inline-flex items-center gap-1 text-xs font-semibold text-ocean hover:text-navy"><FileText className="h-3.5 w-3.5" />Download Report</a>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <aside className="self-start lg:sticky lg:top-20">
          <div className="rounded-2xl border border-border bg-white p-6">
            <div className="font-display text-lg font-extrabold text-navy">Source from this supplier</div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {["Porcelain", "Marble Look", "Mosaic", "Rectified"].map((t) => (
                <span key={t} className="rounded-md bg-secondary px-2 py-0.5 font-mono-data text-xs text-navy">{t}</span>
              ))}
            </div>
            <Link to="/enquiry" className="mt-5 block w-full rounded-md bg-navy py-3 text-center text-sm font-semibold text-white hover:bg-[#1A5491]">
              Request a Quote from this Supplier
            </Link>
            <Link to="/products/tiles-flooring" className="mt-2 block w-full rounded-md border border-navy py-3 text-center text-sm font-semibold text-navy hover:bg-navy hover:text-white">
              Browse their Products
            </Link>
            <div className="mt-5 flex gap-2 rounded-md bg-green/10 p-3 text-xs text-green">
              <ShieldCheck className="h-4 w-4 shrink-0" />
              Coref has completed <span className="font-mono-data font-semibold">14 shipments</span> from this supplier to India.
            </div>
          </div>

          <div className="mt-4 rounded-2xl border border-border bg-white p-6">
            <div className="text-xs font-semibold uppercase tracking-wider text-mutedink">Lead times</div>
            <div className="mt-3 font-mono-data text-2xl font-semibold text-navy">6–8 wks</div>
            <div className="mt-1 text-xs text-mutedink">Typical from order confirmation</div>
            <div className="mt-4 flex items-center gap-2 text-xs text-charcoal"><Award className="h-4 w-4 text-ocean" /> Top 12% on-time delivery</div>
          </div>
        </aside>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-white p-4">
      <div className="text-xs uppercase tracking-wider text-mutedink">{label}</div>
      <div className="mt-1 font-display text-lg font-bold text-navy">{value}</div>
    </div>
  );
}
