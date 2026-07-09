import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import { Upload, FileCheck, Truck, CheckCircle2, Factory, Wrench, Container, FileSpreadsheet, ClipboardCheck, Building2 } from "lucide-react";

export const Route = createFileRoute("/how-it-works")({
  head: () => ({
    meta: [
      { title: "How Coref works — Sourcing & Logistics, end-to-end" },
      { name: "description", content: "From BOQ to site delivery: how Coref sources, inspects, and ships globally for architects, machinery buyers, and businesses." },
      { property: "og:title", content: "How Coref works" },
    ],
  }),
  component: HowPage,
});

type PersonaKey = "architects" | "machinery" | "businesses";

type Step = { title: string; copy: string; sla: string; visual: ReactNode };

const SupplierMatch = ({ rows }: { rows: { n: string; m: number }[] }) => (
  <div className="space-y-2">
    {rows.map((s) => (
      <div key={s.n} className="flex items-center justify-between rounded-lg border border-border bg-white p-3">
        <div>
          <div className="font-display text-sm font-bold text-navy">{s.n}</div>
          <div className="font-mono-data text-xs text-mutedink">Match score</div>
        </div>
        <div className="font-mono-data text-lg font-bold text-green">{s.m}%</div>
      </div>
    ))}
  </div>
);

const DocChecklist = ({ items }: { items: string[] }) => (
  <ul className="space-y-2">
    {items.map((d) => (
      <li key={d} className="flex items-center gap-2 rounded-md border border-border bg-white px-3 py-2 text-sm">
        <FileCheck className="h-4 w-4 text-green" /> <span className="text-charcoal">{d}</span>
      </li>
    ))}
  </ul>
);

const Tracker = ({ ref_, kind, milestones, completed }: { ref_: string; kind: string; milestones: string[]; completed: number }) => (
  <div className="rounded-xl border border-border bg-white p-5">
    <div className="flex items-center gap-2 text-sm font-semibold text-navy"><Truck className="h-4 w-4 text-ocean" /> {ref_} · {kind}</div>
    <div className="mt-5 flex items-center">
      {milestones.map((m, i) => (
        <div key={m} className="flex flex-1 items-center last:flex-none">
          <div className={`h-3 w-3 rounded-full ${i <= completed ? "bg-green" : "bg-border"}`} />
          {i < milestones.length - 1 && <div className={`h-0.5 flex-1 ${i < completed ? "bg-green" : "bg-border"}`} />}
        </div>
      ))}
    </div>
    <div className="mt-2 flex justify-between font-mono-data text-[10px] text-mutedink">
      {milestones.map((m) => <span key={m}>{m}</span>)}
    </div>
  </div>
);

const Dropzone = ({ accept, hint }: { accept: ReactNode; hint: string }) => (
  <div className="rounded-xl border-2 border-dashed border-ocean/40 bg-offwhite p-8 text-center">
    <Upload className="mx-auto h-10 w-10 text-ocean" />
    <div className="mt-3 font-display font-bold text-navy">{accept}</div>
    <div className="font-mono-data text-xs text-mutedink">{hint}</div>
  </div>
);

const PERSONAS: Record<PersonaKey, { label: string; icon: typeof Building2; tagline: string; steps: Step[] }> = {
  architects: {
    label: "Architects",
    icon: Building2,
    tagline: "From BOQ to finished interior. Coref sources every line item and gets samples to your studio.",
    steps: [
      {
        title: "Upload Your BOQ or Drawings",
        copy: "Share your Bill of Quantities, finish schedule, or architectural drawings. Coref reviews within 2 hours.",
        sla: "Reviewed within 2 hours",
        visual: <Dropzone accept="Drop BOQ, drawings, finish schedules" hint="PDF · DWG · XLS · max 20MB" />,
      },
      {
        title: "Coref Matches Suppliers",
        copy: "We identify 2–4 pre-vetted manufacturers per line item — matched on spec, aesthetic, lead time, and budget.",
        sla: "Shortlist within 24 hours",
        visual: <SupplierMatch rows={[{ n: "Verona Stone Works", m: 94 }, { n: "Guangdong Elite Ceramics", m: 88 }, { n: "Castellón Ceramica", m: 81 }]} />,
      },
      {
        title: "Compare Quotes + Request Samples",
        copy: "Receive itemised quotes with FOB and landed cost. Order physical samples shipped to your office.",
        sla: "Samples dispatched within 7 days",
        visual: (
          <div className="overflow-hidden rounded-lg border border-border bg-white">
            <table className="w-full text-xs">
              <thead className="bg-offwhite text-mutedink">
                <tr><th className="px-3 py-2 text-left font-semibold">Supplier</th><th className="px-3 py-2 text-right font-semibold">FOB</th><th className="px-3 py-2 text-right font-semibold">Lead</th><th className="px-3 py-2 text-right font-semibold">MOQ</th></tr>
              </thead>
              <tbody className="font-mono-data">
                <tr className="border-t border-border"><td className="px-3 py-2">Verona</td><td className="px-3 py-2 text-right">₹180</td><td className="px-3 py-2 text-right">10w</td><td className="px-3 py-2 text-right">100</td></tr>
                <tr className="border-t border-border"><td className="px-3 py-2">Guangdong</td><td className="px-3 py-2 text-right">₹58</td><td className="px-3 py-2 text-right">7w</td><td className="px-3 py-2 text-right">200</td></tr>
                <tr className="border-t border-border"><td className="px-3 py-2">Castellón</td><td className="px-3 py-2 text-right">₹38</td><td className="px-3 py-2 text-right">6w</td><td className="px-3 py-2 text-right">250</td></tr>
              </tbody>
            </table>
          </div>
        ),
      },
      {
        title: "Place Order, Coref Handles Export",
        copy: "We raise POs, run pre-shipment inspection, and prepare every export document. You sign one PO with Coref.",
        sla: "Single point of contact",
        visual: <DocChecklist items={["Commercial Invoice", "Packing List", "Bill of Lading", "Certificate of Origin", "Fumigation Certificate"]} />,
      },
      {
        title: "Track Your Procurement to Site",
        copy: "Real-time container tracking with milestone notifications by WhatsApp and email — straight to your project manager.",
        sla: "Live status, all containers",
        visual: <Tracker ref_="CRF-2026-04821" kind="1×40HC · Tiles" milestones={["Loaded", "Sailed", "Customs", "On Site"]} completed={2} />,
      },
    ],
  },
  machinery: {
    label: "Machinery Buyers",
    icon: Wrench,
    tagline: "Source production-grade machinery from vetted factories. Inspection reports before you pay.",
    steps: [
      {
        title: "Upload Machine Spec or RFQ",
        copy: "Share your machine requirement, capacity needs, and tolerances. Our procurement engineer reviews within 4 hours.",
        sla: "Engineer review within 4 hours",
        visual: <Dropzone accept="Drop machine spec, RFQ, or drawings" hint="PDF · DWG · STEP · max 25MB" />,
      },
      {
        title: "Factory Matches Across 12 Markets",
        copy: "We shortlist OEM factories with proven capability, after-sales presence in India, and the right export experience.",
        sla: "Factory shortlist within 48 hours",
        visual: <SupplierMatch rows={[{ n: "Jiangsu Precision Tools", m: 92 }, { n: "Taiwan Servo Systems", m: 86 }, { n: "Bremen MachineWorks", m: 79 }]} />,
      },
      {
        title: "Compare Suppliers & Capacity",
        copy: "Side-by-side comparison on output, power draw, warranty terms, spares lead time, and total landed cost.",
        sla: "Comparison sheet in 24 hours",
        visual: (
          <div className="overflow-hidden rounded-lg border border-border bg-white">
            <table className="w-full text-xs">
              <thead className="bg-offwhite text-mutedink">
                <tr><th className="px-3 py-2 text-left font-semibold">Factory</th><th className="px-3 py-2 text-right font-semibold">Output</th><th className="px-3 py-2 text-right font-semibold">Warranty</th><th className="px-3 py-2 text-right font-semibold">FOB</th></tr>
              </thead>
              <tbody className="font-mono-data">
                <tr className="border-t border-border"><td className="px-3 py-2">Jiangsu</td><td className="px-3 py-2 text-right">120 u/hr</td><td className="px-3 py-2 text-right">24 mo</td><td className="px-3 py-2 text-right">$48k</td></tr>
                <tr className="border-t border-border"><td className="px-3 py-2">Taiwan SS</td><td className="px-3 py-2 text-right">110 u/hr</td><td className="px-3 py-2 text-right">36 mo</td><td className="px-3 py-2 text-right">$62k</td></tr>
                <tr className="border-t border-border"><td className="px-3 py-2">Bremen</td><td className="px-3 py-2 text-right">140 u/hr</td><td className="px-3 py-2 text-right">24 mo</td><td className="px-3 py-2 text-right">$89k</td></tr>
              </tbody>
            </table>
          </div>
        ),
      },
      {
        title: "Pre-Shipment Inspection & Test Run",
        copy: "Third-party inspector or our engineer attends factory acceptance test (FAT). You receive a signed report and video.",
        sla: "Inspection report before balance payment",
        visual: (
          <div className="rounded-xl border border-border bg-white p-5">
            <div className="flex items-center gap-2"><ClipboardCheck className="h-5 w-5 text-green" /><div className="font-display text-sm font-bold text-navy">FAT Report · INS-2026-118</div></div>
            <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
              <div><div className="text-mutedink">Dimensional QC</div><div className="font-mono-data font-semibold text-green">PASS</div></div>
              <div><div className="text-mutedink">Load test (8hr)</div><div className="font-mono-data font-semibold text-green">PASS</div></div>
              <div><div className="text-mutedink">Power draw</div><div className="font-mono-data font-semibold text-green">PASS</div></div>
              <div><div className="text-mutedink">Safety interlocks</div><div className="font-mono-data font-semibold text-green">PASS</div></div>
            </div>
          </div>
        ),
      },
      {
        title: "Track Shipment + Installation Handover",
        copy: "Container tracking through customs, plus coordination with the OEM's engineer for on-site commissioning.",
        sla: "Commissioning within 14 days of arrival",
        visual: <Tracker ref_="CRF-2026-04822" kind="1×40OT · Machinery" milestones={["FAT", "Loaded", "Sailed", "Commissioned"]} completed={2} />,
      },
    ],
  },
  businesses: {
    label: "Businesses",
    icon: Container,
    tagline: "Import goods at landed-cost clarity. Manage every project from one dashboard.",
    steps: [
      {
        title: "Share Your Import Requirement",
        copy: "Tell us what you import — packaging, components, finished goods. Volume, frequency, destination ports.",
        sla: "Account manager assigned within 1 day",
        visual: <Dropzone accept="Drop product spec, HS code, or supplier list" hint="PDF · XLS · CSV · max 15MB" />,
      },
      {
        title: "Landed Cost Modelling",
        copy: "Get a full landed cost model — FOB, freight, duties, port handling, inland — before you commit to a supplier.",
        sla: "Cost model within 24 hours",
        visual: (
          <div className="rounded-xl border border-border bg-white p-5">
            <div className="flex items-center gap-2"><FileSpreadsheet className="h-5 w-5 text-ocean" /><div className="font-display text-sm font-bold text-navy">Landed cost model</div></div>
            <table className="mt-3 w-full text-xs font-mono-data">
              <tbody>
                {[["FOB", "₹4,80,000"], ["Sea freight", "₹52,000"], ["Customs & duties", "₹96,000"], ["CFS / Port", "₹18,000"], ["Inland (Mumbai)", "₹22,000"]].map(([k, v]) => (
                  <tr key={k} className="border-t border-border"><td className="px-3 py-2 text-charcoal">{k}</td><td className="px-3 py-2 text-right text-navy">{v}</td></tr>
                ))}
                <tr className="bg-navy text-white"><td className="px-3 py-2 font-display font-bold">Total landed</td><td className="px-3 py-2 text-right font-display font-extrabold">₹6,68,000</td></tr>
              </tbody>
            </table>
          </div>
        ),
      },
      {
        title: "Coref Manages PO + Compliance",
        copy: "We raise the PO, manage payment terms with the supplier, and own the export and customs paperwork.",
        sla: "Single invoice from Coref",
        visual: <DocChecklist items={["Commercial Invoice", "Packing List", "Bill of Lading", "Certificate of Origin", "BIS / FSSAI where applicable"]} />,
      },
      {
        title: "Live Container Status",
        copy: "Container tracking with milestone push-notifications. Vessel ETAs auto-updated against the original plan.",
        sla: "Updates pushed within 1 hour of milestone",
        visual: <Tracker ref_="CRF-2026-04823" kind="2×40HC · Packaging" milestones={["Loaded", "Sailed", "Port", "Warehouse"]} completed={3} />,
      },
      {
        title: "Manage Multiple Projects",
        copy: "Switch between active orders, download documents, and review supplier performance — all in one dashboard.",
        sla: "All documents in one place",
        visual: (
          <div className="rounded-xl border border-border bg-white p-5">
            <div className="grid grid-cols-3 gap-3 text-center">
              {[{ n: "7", l: "Active orders" }, { n: "23", l: "Docs available" }, { n: "94%", l: "On-time rate" }].map((s) => (
                <div key={s.l} className="rounded-lg bg-offwhite p-3">
                  <div className="font-display text-2xl font-extrabold text-navy">{s.n}</div>
                  <div className="text-[10px] uppercase tracking-wider text-mutedink">{s.l}</div>
                </div>
              ))}
            </div>
            <div className="mt-3 flex items-center gap-2 text-xs text-charcoal"><Factory className="h-4 w-4 text-ocean" /> 4 active suppliers · 3 destinations</div>
          </div>
        ),
      },
    ],
  },
};

function HowPage() {
  const [persona, setPersona] = useState<PersonaKey>("architects");
  const active = PERSONAS[persona];

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
      <h1 className="font-display text-4xl font-extrabold text-navy sm:text-5xl">How Coref works</h1>
      <p className="mt-3 max-w-2xl text-charcoal">A single partner for sourcing, quality, freight, and customs — designed for the way you actually build.</p>

      <div className="mt-8 flex flex-wrap gap-2 border-b border-border">
        {(Object.keys(PERSONAS) as PersonaKey[]).map((k) => {
          const Icon = PERSONAS[k].icon;
          return (
            <button
              key={k}
              onClick={() => setPersona(k)}
              className={`relative -mb-px inline-flex items-center gap-2 px-4 py-3 text-sm font-semibold transition-colors ${persona === k ? "text-navy" : "text-mutedink hover:text-charcoal"}`}
            >
              <Icon className="h-4 w-4" />
              {PERSONAS[k].label}
              {persona === k && <span className="absolute inset-x-0 -bottom-px h-0.5 bg-ocean" />}
            </button>
          );
        })}
      </div>

      <div key={persona} className="mt-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
        <div className="rounded-xl border border-border bg-offwhite p-5 text-charcoal">{active.tagline}</div>

        <div className="mt-12 space-y-20">
          {active.steps.map((s, i) => {
            const reversed = i % 2 === 1;
            return (
              <div key={s.title} className={`grid items-center gap-10 lg:grid-cols-2 ${reversed ? "lg:[&>*:first-child]:order-2" : ""}`}>
                <div>
                  <div className="font-mono-data text-xs uppercase tracking-[0.2em] text-ocean">Step 0{i + 1}</div>
                  <h2 className="mt-2 font-display text-3xl font-extrabold text-navy">{s.title}</h2>
                  <p className="mt-3 max-w-md text-charcoal">{s.copy}</p>
                  <div className="mt-4 flex items-center gap-2 text-xs text-green"><CheckCircle2 className="h-4 w-4" /> {s.sla}</div>
                </div>
                <div>{s.visual}</div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-20 rounded-2xl bg-navy p-10 text-center text-white">
        <h2 className="font-display text-3xl font-extrabold">Ready to start your first sourcing request?</h2>
        <p className="mt-3 text-white/70">Share what you need. We'll come back within 24 hours.</p>
        <Link to="/enquiry" className="mt-6 inline-block rounded-md bg-ocean px-6 py-3 text-sm font-semibold text-navy hover:bg-white">
          Submit a Requirement
        </Link>
      </div>
    </div>
  );
}
