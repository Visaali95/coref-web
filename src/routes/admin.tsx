import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Package, Upload, Factory, ClipboardList, Settings, ArrowLeft,
  UploadCloud, CheckCircle2, Pencil, Eye, Search,
} from "lucide-react";
import { CorefLogo } from "@/components/coref/Logo";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Coref Admin" },
      { name: "description", content: "Internal Coref admin panel." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminApp,
});

type Nav = "catalogue" | "upload" | "suppliers" | "enquiries" | "settings";

function AdminApp() {
  const [authed, setAuthed] = useState(false);
  const [nav, setNav] = useState<Nav>("upload");

  useEffect(() => {
    if (typeof window !== "undefined" && sessionStorage.getItem("coref_admin_authed") === "1") {
      setAuthed(true);
    }
  }, []);

  const signIn = () => {
    if (typeof window !== "undefined") sessionStorage.setItem("coref_admin_authed", "1");
    setAuthed(true);
  };

  if (!authed) return <Login onSubmit={signIn} />;

  return (
    <div className="flex min-h-screen bg-offwhite">
      <aside className="flex w-56 flex-col bg-navy text-white">
        <div className="border-b border-white/10 p-5">
          <CorefLogo inverted />
        </div>
        <nav className="flex-1 space-y-1 p-3 text-sm">
          {([
            ["catalogue", "Product Catalogue", Package],
            ["upload", "Upload Catalogue", Upload],
            ["suppliers", "Suppliers", Factory],
            ["enquiries", "Enquiries", ClipboardList],
            ["settings", "Settings", Settings],
          ] as const).map(([key, label, Icon]) => (
            <button
              key={key}
              onClick={() => setNav(key)}
              className={`flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left transition-colors ${
                nav === key ? "bg-white/15 font-semibold" : "text-white/75 hover:bg-white/10 hover:text-white"
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </nav>
        <div className="border-t border-white/10 p-3">
          <Link to="/" className="flex items-center gap-2 rounded-md px-3 py-2 text-xs text-white/70 hover:bg-white/10 hover:text-white">
            <ArrowLeft className="h-4 w-4" /> Back to Website
          </Link>
        </div>
      </aside>

      <main className="flex-1 overflow-x-hidden">
        <div className="border-b border-border bg-white px-8 py-4 text-sm text-mutedink">
          Signed in as <span className="font-semibold text-navy">admin@coref.in</span>
        </div>
        <div className="p-8">
          {nav === "upload" && <UploadPage />}
          {nav === "catalogue" && <CataloguePage />}
          {nav === "suppliers" && <PlaceholderBlock title="Suppliers" desc="Manage Chinese factory partners and inspection history." />}
          {nav === "enquiries" && <EnquiriesPage />}
          {nav === "settings" && <PlaceholderBlock title="Settings" desc="Team, notifications, exchange rates." />}
        </div>
      </main>
    </div>
  );
}

function Login({ onSubmit }: { onSubmit: () => void }) {
  return (
    <div className="grid min-h-screen place-items-center bg-navy px-4">
      <form
        onSubmit={(e) => { e.preventDefault(); onSubmit(); }}
        className="w-full max-w-sm rounded-xl bg-white p-8 shadow-2xl"
      >
        <div className="mb-6 flex justify-center"><CorefLogo /></div>
        <h1 className="text-center font-display text-xl font-bold text-navy">Admin Sign In</h1>
        <p className="mt-1 text-center text-xs text-mutedink">Coref internal team only.</p>
        <div className="mt-6 space-y-3">
          <input type="email" required defaultValue="admin@coref.in" className="w-full rounded-md border border-input bg-offwhite px-3 py-2.5 text-sm outline-none focus:border-ocean" placeholder="Email" />
          <input type="password" required defaultValue="demo1234" className="w-full rounded-md border border-input bg-offwhite px-3 py-2.5 text-sm outline-none focus:border-ocean" placeholder="Password" />
        </div>
        <button
          type="button"
          onClick={onSubmit}
          className="mt-6 w-full rounded-md bg-navy py-2.5 text-sm font-semibold text-white hover:bg-[#1A5491]"
        >
          Sign In
        </button>
        <p className="mt-3 text-center text-[10px] text-mutedink">Demo: any credentials work</p>
      </form>
    </div>
  );
}

type ExtractedProduct = {
  id: number; name: string; category: string; spec: string;
  price: string; lead: string; ready: boolean; published?: boolean;
};

const MOCK_EXTRACTED: ExtractedProduct[] = [
  { id: 1, name: "Marble Look Porcelain — Calacatta", category: "Tiles & Flooring", spec: "600×1200mm · Matt · Porcelain", price: "₹48–68", lead: "6–8 weeks", ready: true },
  { id: 2, name: "Marble Look Porcelain — Statuario", category: "Tiles & Flooring", spec: "600×1200mm · Glossy · Porcelain", price: "₹52–72", lead: "6–8 weeks", ready: true },
  { id: 3, name: "Wood Look Plank Tile — Oak", category: "Tiles & Flooring", spec: "200×1200mm · Matt · Porcelain", price: "₹62–84", lead: "8–10 weeks", ready: true },
  { id: 4, name: "Terrazzo Look Tile — Grey", category: "Tiles & Flooring", spec: "600×600mm · Honed · Porcelain", price: "₹55–75", lead: "6–8 weeks", ready: true },
  { id: 5, name: "Concrete Look Tile — Industrial", category: "Tiles & Flooring", spec: "600×600mm · Matt · Porcelain", price: "₹45–62", lead: "6–8 weeks", ready: true },
  { id: 6, name: "Mosaic Hexagon — Carrara", category: "Tiles & Flooring", spec: "Hexagonal · 100mm · Marble", price: "₹120–165", lead: "8–12 weeks", ready: false },
  { id: 7, name: "Subway Tile — Gloss White", category: "Tiles & Flooring", spec: "75×150mm · Glossy · Ceramic", price: "₹28–38", lead: "4–6 weeks", ready: true },
  { id: 8, name: "Outdoor Anti-Skid — Slate Grey", category: "Tiles & Flooring", spec: "300×600mm · R11 · Porcelain", price: "₹58–78", lead: "6–8 weeks", ready: true },
  { id: 9, name: "Bathroom Wall Tile — Beige", category: "Tiles & Flooring", spec: "300×600mm · Glossy · Ceramic", price: "₹32–44", lead: "4–6 weeks", ready: true },
  { id: 10, name: "Large Format Slab — Onyx", category: "Tiles & Flooring", spec: "1200×2400mm · Polished · Porcelain", price: "₹220–310", lead: "10–12 weeks", ready: false },
  { id: 11, name: "Mosaic Penny Round — Black", category: "Tiles & Flooring", spec: "20mm round · Matt · Porcelain", price: "₹95–130", lead: "6–8 weeks", ready: true },
  { id: 12, name: "Pool Tile — Aqua Blue", category: "Tiles & Flooring", spec: "240×115mm · Glossy · Porcelain", price: "₹85–112", lead: "8–10 weeks", ready: true },
];

function UploadPage() {
  const [stage, setStage] = useState<"idle" | "processing" | "review">("idle");
  const [progress, setProgress] = useState(0);
  const [statusIdx, setStatusIdx] = useState(0);
  const [rows, setRows] = useState<ExtractedProduct[]>(MOCK_EXTRACTED);
  const [selected, setSelected] = useState<Set<number>>(new Set(MOCK_EXTRACTED.map((r) => r.id)));
  const [toast, setToast] = useState<string | null>(null);

  const statuses = [
    "Reading PDF pages...",
    "Identifying product entries...",
    "Extracting specifications...",
    "Parsing pricing and dimensions...",
    "Generating product listings...",
    "Done! 12 products extracted.",
  ];

  const startProcessing = () => {
    setStage("processing");
    setProgress(0);
    setStatusIdx(0);
    const total = 3000;
    const tickMs = 50;
    let elapsed = 0;
    const interval = setInterval(() => {
      elapsed += tickMs;
      setProgress(Math.min(100, (elapsed / total) * 100));
      setStatusIdx(Math.min(statuses.length - 1, Math.floor((elapsed / total) * statuses.length)));
      if (elapsed >= total) {
        clearInterval(interval);
        setTimeout(() => setStage("review"), 400);
      }
    }, tickMs);
  };

  const toggle = (id: number) => {
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  };

  const publish = () => {
    setRows((rs) => rs.map((r) => (selected.has(r.id) ? { ...r, published: true } : r)));
    setToast(`✓ ${selected.size} products added to live catalogue`);
    setTimeout(() => setToast(null), 3000);
  };

  return (
    <div>
      <h1 className="font-display text-2xl font-extrabold text-navy">Upload Supplier Catalogue</h1>
      <p className="mt-1 text-sm text-mutedink">
        Upload a supplier's PDF catalogue. Coref's system reads it automatically and extracts individual products into the catalogue.
      </p>

      {stage === "idle" && (
        <div className="mt-8 max-w-3xl space-y-6">
          <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-ocean/50 bg-white px-6 py-14 text-center hover:border-ocean">
            <input type="file" accept="application/pdf" className="hidden" />
            <UploadCloud className="h-12 w-12 text-navy" />
            <div className="mt-4 font-display text-base font-bold text-navy">Drag & drop a supplier PDF catalogue here</div>
            <div className="mt-1 text-xs text-mutedink">or click to browse · PDF only · max 50MB</div>
            <span className="mt-4 rounded-md border border-navy px-4 py-2 text-xs font-semibold text-navy">Browse File</span>
          </label>

          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Supplier Name" placeholder="Guangdong Elite Ceramics" />
            <SelectField label="Product Category" options={["Tiles & Flooring", "Sanitaryware", "Machinery", "Surface Finishes", "Structural", "Lighting", "Other"]} />
            <Field label="Default Origin" defaultValue="🇨🇳 China" readOnly />
          </div>

          <button onClick={startProcessing} className="rounded-md bg-navy px-6 py-3 text-sm font-semibold text-white hover:bg-[#1A5491]">
            Upload & Extract →
          </button>
        </div>
      )}

      {stage === "processing" && (
        <div className="mt-10 max-w-2xl rounded-xl border border-border bg-white p-10 text-center">
          <div className="font-display text-lg font-bold text-navy">Processing catalogue…</div>
          <div className="mt-6 h-2 w-full overflow-hidden rounded-full bg-offwhite">
            <div className="h-full bg-ocean transition-[width] duration-150" style={{ width: `${progress}%` }} />
          </div>
          <div className="mt-4 font-mono-data text-xs text-mutedink">{progress.toFixed(0)}%</div>
          <div className="mt-6 text-sm text-charcoal">{statuses[statusIdx]}</div>
        </div>
      )}

      {stage === "review" && (
        <div className="mt-8">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="font-display text-xl font-extrabold text-navy">12 products extracted — review before publishing</h2>
              <p className="mt-1 text-sm text-mutedink">Each product has been auto-filled. Edit any field before adding to the live catalogue.</p>
            </div>
            <div className="text-xs font-mono-data text-mutedink">{selected.size} of {rows.length} selected</div>
          </div>

          <div className="mt-5 overflow-hidden rounded-xl border border-border bg-white">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-offwhite text-mutedink">
                  <tr>
                    <th className="px-3 py-2"><input type="checkbox" checked={selected.size === rows.length} onChange={(e) => setSelected(new Set(e.target.checked ? rows.map((r) => r.id) : []))} /></th>
                    <th className="px-3 py-2">Image</th>
                    <th className="px-3 py-2">Product Name</th>
                    <th className="px-3 py-2">Category</th>
                    <th className="px-3 py-2">Spec</th>
                    <th className="px-3 py-2">FOB Price</th>
                    <th className="px-3 py-2">Lead Time</th>
                    <th className="px-3 py-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id} className="border-t border-border align-middle">
                      <td className="px-3 py-2"><input type="checkbox" checked={selected.has(r.id)} onChange={() => toggle(r.id)} /></td>
                      <td className="px-3 py-2"><div className="h-10 w-10 rounded bg-offwhite" /></td>
                      <td className="px-3 py-2"><input defaultValue={r.name} className="w-56 rounded border border-transparent bg-transparent px-2 py-1 hover:border-input focus:border-ocean focus:bg-white focus:outline-none" /></td>
                      <td className="px-3 py-2"><input defaultValue={r.category} className="w-36 rounded border border-transparent bg-transparent px-2 py-1 hover:border-input focus:border-ocean focus:bg-white focus:outline-none" /></td>
                      <td className="px-3 py-2"><input defaultValue={r.spec} className="w-56 rounded border border-transparent bg-transparent px-2 py-1 font-mono-data text-[11px] hover:border-input focus:border-ocean focus:bg-white focus:outline-none" /></td>
                      <td className="px-3 py-2"><input defaultValue={r.price} className="w-24 rounded border border-transparent bg-transparent px-2 py-1 font-mono-data hover:border-input focus:border-ocean focus:bg-white focus:outline-none" /></td>
                      <td className="px-3 py-2"><input defaultValue={r.lead} className="w-24 rounded border border-transparent bg-transparent px-2 py-1 hover:border-input focus:border-ocean focus:bg-white focus:outline-none" /></td>
                      <td className="px-3 py-2">
                        {r.published ? (
                          <span className="inline-flex items-center gap-1 rounded bg-green/15 px-2 py-0.5 text-[10px] font-semibold text-green"><CheckCircle2 className="h-3 w-3" />Published</span>
                        ) : r.ready ? (
                          <span className="rounded bg-green/15 px-2 py-0.5 text-[10px] font-semibold text-green">Ready to Publish</span>
                        ) : (
                          <span className="rounded bg-gold/20 px-2 py-0.5 text-[10px] font-semibold text-gold">Needs Review</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-3">
            <button onClick={publish} className="rounded-md bg-navy px-6 py-3 text-sm font-semibold text-white hover:bg-[#1A5491]">
              Publish Selected to Catalogue
            </button>
            <button className="rounded-md border border-navy px-6 py-3 text-sm font-semibold text-navy hover:bg-navy hover:text-white">
              Save as Draft
            </button>
            <button onClick={() => { setStage("idle"); setRows(MOCK_EXTRACTED); }} className="rounded-md px-6 py-3 text-sm font-semibold text-mutedink hover:text-navy">
              Upload Another
            </button>
          </div>

          {toast && (
            <div className="fixed bottom-6 right-6 z-50 rounded-md bg-green px-4 py-3 text-sm font-semibold text-white shadow-lg">
              {toast}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function CataloguePage() {
  const products = [
    { id: 1, name: "Italian Marble Look Porcelain", cat: "Tiles & Flooring", sup: "Guangdong Elite", price: "₹58–72", status: "Published" },
    { id: 2, name: "Matte Black Basin Mixer Tap", cat: "Sanitaryware", sup: "Wenzhou Brass Works", price: "₹3.2K–4.8K", status: "Published" },
    { id: 3, name: "CNC Laser Cutting Machine 1325", cat: "Machinery", sup: "Jinan Precision", price: "₹4.2L–5.8L", status: "Published" },
    { id: 4, name: "Terrazzo Cement Floor Tile", cat: "Tiles & Flooring", sup: "Foshan Tile Co.", price: "₹85–110", status: "Draft" },
    { id: 5, name: "LED Recessed Panel 60×60", cat: "Lighting", sup: "Shenzhen Lumens", price: "₹680–920", status: "Published" },
    { id: 6, name: "Galvanised Steel C-Purlin", cat: "Structural", sup: "Tianjin Steel", price: "₹62–78", status: "Needs Review" },
  ];
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-extrabold text-navy">Product Catalogue</h1>
        <button className="inline-flex items-center gap-2 rounded-md bg-navy px-4 py-2 text-sm font-semibold text-white hover:bg-[#1A5491]">
          <Upload className="h-4 w-4" /> Upload New Catalogue
        </button>
      </div>

      <div className="mt-5 flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-mutedink" />
          <input placeholder="Search products…" className="w-full rounded-md border border-input bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-ocean" />
        </div>
        <select className="rounded-md border border-input bg-white px-3 py-2 text-sm"><option>All Categories</option></select>
        <select className="rounded-md border border-input bg-white px-3 py-2 text-sm"><option>All Suppliers</option></select>
        <select className="rounded-md border border-input bg-white px-3 py-2 text-sm"><option>All Status</option><option>Published</option><option>Draft</option><option>Needs Review</option></select>
      </div>

      <div className="mt-5 overflow-hidden rounded-xl border border-border bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-offwhite text-xs text-mutedink">
            <tr>
              <th className="px-4 py-2.5">Product</th>
              <th className="px-4 py-2.5">Category</th>
              <th className="px-4 py-2.5">Supplier</th>
              <th className="px-4 py-2.5">FOB Price</th>
              <th className="px-4 py-2.5">Status</th>
              <th className="px-4 py-2.5">Actions</th>
            </tr>
          </thead>
          <tbody>
            {products.map((p) => (
              <tr key={p.id} className="border-t border-border">
                <td className="px-4 py-3"><div className="flex items-center gap-3"><div className="h-9 w-9 rounded bg-offwhite" /><span className="font-medium text-navy">{p.name}</span></div></td>
                <td className="px-4 py-3 text-charcoal">{p.cat}</td>
                <td className="px-4 py-3 text-charcoal">{p.sup}</td>
                <td className="px-4 py-3 font-mono-data text-charcoal">{p.price}</td>
                <td className="px-4 py-3">
                  <span className={`rounded px-2 py-0.5 text-[10px] font-semibold ${
                    p.status === "Published" ? "bg-green/15 text-green" :
                    p.status === "Draft" ? "bg-secondary text-navy" :
                    "bg-gold/20 text-gold"
                  }`}>{p.status}</span>
                </td>
                <td className="px-4 py-3"><div className="flex gap-2 text-mutedink"><button className="hover:text-navy"><Pencil className="h-4 w-4" /></button><button className="hover:text-navy"><Eye className="h-4 w-4" /></button></div></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function EnquiriesPage() {
  const enquiries = [
    { ref: "CRF-2026-04821", name: "Rohan Patel", co: "Studio Linework", role: "Architect", items: "Porcelain tile (500sqm), Basin mixer (24)", date: "29 Jun 2026", status: "New" },
    { ref: "CRF-2026-04820", name: "Ananya Rao", co: "Built Forms", role: "Interior Designer", items: "Marble slab (180sqm)", date: "29 Jun 2026", status: "In Progress" },
    { ref: "CRF-2026-04819", name: "Vikram Shah", co: "ShahCon Pvt", role: "Developer", items: "Vitrified tile (12000sqm)", date: "28 Jun 2026", status: "Quoted" },
    { ref: "CRF-2026-04818", name: "Karthik N.", co: "Madras Mech", role: "Machinery Buyer", items: "CNC laser cutter (2 units)", date: "28 Jun 2026", status: "Quoted" },
    { ref: "CRF-2026-04817", name: "Priya M.", co: "M&M Interiors", role: "Architect", items: "Recessed LED panels (140)", date: "27 Jun 2026", status: "Closed" },
  ];
  const chipClass = (s: string) =>
    s === "New" ? "bg-gold/20 text-gold" :
    s === "In Progress" ? "bg-ocean/20 text-navy" :
    s === "Quoted" ? "bg-green/15 text-green" :
    "bg-secondary text-mutedink";

  return (
    <div>
      <h1 className="font-display text-2xl font-extrabold text-navy">Enquiries</h1>
      <p className="mt-1 text-sm text-mutedink">Sourcing requests submitted via the website.</p>
      <div className="mt-5 overflow-hidden rounded-xl border border-border bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-offwhite text-xs text-mutedink">
            <tr>
              <th className="px-4 py-2.5">Reference</th>
              <th className="px-4 py-2.5">Name</th>
              <th className="px-4 py-2.5">Company</th>
              <th className="px-4 py-2.5">Role</th>
              <th className="px-4 py-2.5">Products</th>
              <th className="px-4 py-2.5">Submitted</th>
              <th className="px-4 py-2.5">Status</th>
            </tr>
          </thead>
          <tbody>
            {enquiries.map((e) => (
              <tr key={e.ref} className="cursor-pointer border-t border-border hover:bg-offwhite">
                <td className="px-4 py-3 font-mono-data text-xs text-navy">{e.ref}</td>
                <td className="px-4 py-3 font-medium text-navy">{e.name}</td>
                <td className="px-4 py-3 text-charcoal">{e.co}</td>
                <td className="px-4 py-3 text-charcoal">{e.role}</td>
                <td className="px-4 py-3 text-charcoal">{e.items}</td>
                <td className="px-4 py-3 text-mutedink">{e.date}</td>
                <td className="px-4 py-3"><span className={`rounded px-2 py-0.5 text-[10px] font-semibold ${chipClass(e.status)}`}>{e.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PlaceholderBlock({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="rounded-xl border border-dashed border-border bg-white p-10 text-center">
      <h1 className="font-display text-2xl font-extrabold text-navy">{title}</h1>
      <p className="mt-2 text-sm text-mutedink">{desc}</p>
    </div>
  );
}

function Field({ label, ...rest }: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="block">
      <span className="block text-xs font-semibold uppercase tracking-wider text-mutedink">{label}</span>
      <input {...rest} className="mt-1 w-full rounded-md border border-input bg-white px-3 py-2.5 text-sm outline-none focus:border-ocean" />
    </label>
  );
}

function SelectField({ label, options }: { label: string; options: string[] }) {
  return (
    <label className="block">
      <span className="block text-xs font-semibold uppercase tracking-wider text-mutedink">{label}</span>
      <select className="mt-1 w-full rounded-md border border-input bg-white px-3 py-2.5 text-sm outline-none focus:border-ocean">
        {options.map((o) => <option key={o}>{o}</option>)}
      </select>
    </label>
  );
}
