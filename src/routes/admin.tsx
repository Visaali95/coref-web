import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type ChangeEventHandler, type InputHTMLAttributes } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Package,
  Upload,
  Factory,
  ClipboardList,
  Settings,
  ArrowLeft,
  UploadCloud,
  Pencil,
  Eye,
  Search,
  X,
  Mail,
  Phone,
  ChevronDown,
  ChevronUp,
  Globe,
  FileText,
  Loader2,
  Paperclip,
  ExternalLink,
  AlertCircle,
  CheckCircle,
} from "lucide-react";
import { CorefLogo } from "@/components/coref/Logo";
import { apiFetch, apiUrl } from "@/lib/api";

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

// ─── Shared category list (single source of truth across all admin UI) ──────────
const CATEGORIES = ["Tiles & Flooring", "Sanitaryware", "Machinery", "Surface Finishes", "Structural", "Lighting", "Other"];

type Product = {
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

type ProductCreateInput = Omit<Product, "id" | "createdAt" | "updatedAt">;

type Enquiry = {
  id: number;
  reference: string;
  name: string;
  company: string;
  role: string;
  items: string;
  message: string;
  attachments?: string | null;
  submittedAt: string;
  status: string;
  email?: string;
  phone?: string;
};

type UploadRow = {
  id: number;
  name: string;
  category: string;
  supplier: string;
  fobPrice: string;
  leadTime: string;
  imageUrl?: string | null;
  status: string;
};

type PdfSuggestion = {
  name: string;
  category: string;
  supplier?: string;
  fobPrice?: string;
  leadTime?: string;
  imageUrl?: string | null;
};

// ─── Status badge helpers ──────────────────────────────────────────────────────
const PRODUCT_STATUS_STYLES: Record<string, string> = {
  Published: "bg-green/15 text-green",
  Draft: "bg-secondary text-navy",
  "Needs Review": "bg-gold/20 text-gold",
};

const ENQUIRY_STATUS_STYLES: Record<string, string> = {
  New: "bg-gold/20 text-gold",
  "In Progress": "bg-ocean/20 text-navy",
  Quoted: "bg-green/15 text-green",
  Closed: "bg-secondary text-mutedink",
};

// ─── Product View Modal ────────────────────────────────────────────────────────
function ProductViewModal({ product, onClose }: { product: Product; onClose: () => void }) {
  const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000";
  const imgSrc = product.imageUrl
    ? `${API_BASE}${product.imageUrl}`
    : `https://picsum.photos/seed/prod-${product.id}/900/600`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between border-b border-border p-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-mutedink">Product Details</p>
            <h2 className="mt-1 font-display text-xl font-extrabold text-navy leading-tight">{product.name}</h2>
          </div>
          <button
            onClick={onClose}
            className="ml-4 rounded-md p-1.5 text-mutedink hover:bg-offwhite hover:text-navy"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Product image */}
        <div className="aspect-[16/9] overflow-hidden bg-secondary">
          <img src={imgSrc} alt={product.name} className="h-full w-full object-cover" />
        </div>

        {/* Body */}
        <div className="grid grid-cols-2 gap-4 p-6">
          <DetailRow label="Category" value={product.category} />
          <DetailRow label="Supplier" value={product.supplier} />
          <DetailRow label="FOB Price" value={product.fobPrice} mono />
          <DetailRow label="Lead Time" value={product.leadTime || "—"} />
          <div className="col-span-2 flex items-center gap-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-mutedink">Status</span>
            <span className={`rounded px-2.5 py-1 text-xs font-semibold ${PRODUCT_STATUS_STYLES[product.status] ?? "bg-secondary text-navy"}`}>
              {product.status}
            </span>
          </div>
          <div className="col-span-2 border-t border-border pt-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-mutedink">Created</p>
            <p className="mt-1 font-mono-data text-xs text-charcoal">{new Date(product.createdAt).toLocaleString()}</p>
          </div>
          <div className="col-span-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-mutedink">Last Updated</p>
            <p className="mt-1 font-mono-data text-xs text-charcoal">{new Date(product.updatedAt).toLocaleString()}</p>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-border px-6 py-4">
          <button
            onClick={onClose}
            className="w-full rounded-md bg-navy py-2.5 text-sm font-semibold text-white hover:bg-[#1A5491]"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function DetailRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wider text-mutedink">{label}</p>
      <p className={`mt-1 text-sm text-navy ${mono ? "font-mono-data" : ""}`}>{value}</p>
    </div>
  );
}

// ─── Admin App Shell ───────────────────────────────────────────────────────────
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
              }`}>
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

// ─── Login ─────────────────────────────────────────────────────────────────────
function Login({ onSubmit }: { onSubmit: () => void }) {
  return (
    <div className="grid min-h-screen place-items-center bg-navy px-4">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit();
        }}
        className="w-full max-w-sm rounded-xl bg-white p-8 shadow-2xl"
      >
        <div className="mb-6 flex justify-center"><CorefLogo /></div>
        <h1 className="text-center font-display text-xl font-bold text-navy">Admin Sign In</h1>
        <p className="mt-1 text-center text-xs text-mutedink">Coref internal team only.</p>
        <div className="mt-6 space-y-3">
          <input type="email" required defaultValue="admin@coref.in" className="w-full rounded-md border border-input bg-offwhite px-3 py-2.5 text-sm outline-none focus:border-ocean" placeholder="Email" />
          <input type="password" required defaultValue="demo1234" className="w-full rounded-md border border-input bg-offwhite px-3 py-2.5 text-sm outline-none focus:border-ocean" placeholder="Password" />
        </div>
        <button type="button" onClick={onSubmit} className="mt-6 w-full rounded-md bg-navy py-2.5 text-sm font-semibold text-white hover:bg-[#1A5491]">
          Sign In
        </button>
        <p className="mt-3 text-center text-[10px] text-mutedink">Demo: any credentials work</p>
      </form>
    </div>
  );
}

// ─── Upload Catalogue Page ─────────────────────────────────────────────────────
function UploadPage() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [stage, setStage] = useState<"idle" | "uploading" | "review">("idle");
  const [rows, setRows] = useState<UploadRow[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [defaultCategory, setDefaultCategory] = useState(CATEGORIES[0]);
  const queryClient = useQueryClient();

  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!selectedFile) throw new Error("Please select a PDF file.");
      const formData = new FormData();
      formData.append("file", selectedFile);
      const response = await fetch(apiUrl("/api/upload/pdf"), { method: "POST", body: formData });
      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || "Upload failed.");
      }
      return response.json() as Promise<{ suggestions: PdfSuggestion[] }>;
    },
    onMutate: () => {
      setStage("uploading");
      setError(null);
    },
    onSuccess: (data) => {
      const nextRows = data.suggestions.map((suggestion, index) => ({
        id: index + 1,
        name: suggestion.name,
        // Use pixel-classified category if present, otherwise fall back to defaultCategory
        category: suggestion.category || defaultCategory,
        supplier: suggestion.supplier ?? "",
        fobPrice: suggestion.fobPrice ?? "",
        leadTime: suggestion.leadTime ?? "",
        imageUrl: suggestion.imageUrl ?? null,
        status: "Draft",
      }));
      setRows(nextRows);
      setSelected(new Set(nextRows.map((row) => row.id)));
      setStage("review");
    },
    onError: (err) => {
      setError((err as Error).message || "Upload failed.");
      setStage("idle");
    },
  });

  const saveMutation = useMutation({
    mutationFn: async ({ products, status }: { products: ProductCreateInput[]; status: string }) => {
      await Promise.all(
        products.map((product) =>
          apiFetch<Product>("/api/products", { method: "POST", body: JSON.stringify({ ...product, status }) })
        )
      );
    },
    onSuccess: (_, { status }) => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      setToast(status === "Published" ? "Selected products published to catalogue." : "Selected products saved as Draft.");
      setTimeout(() => setToast(null), 3500);
    },
    onError: () => {
      setToast("Unable to save products. Please try again.");
      setTimeout(() => setToast(null), 3000);
    },
  });

  const handleFileChange = (file: File | null) => {
    setSelectedFile(file);
    setError(null);
  };

  const buildPayload = (status: string) => {
    const selectedRows = rows.filter((row) => selected.has(row.id));
    return selectedRows.map((row) => ({
      name: row.name,
      category: row.category,
      supplier: row.supplier || "Unknown Supplier",
      fobPrice: row.fobPrice || "TBD",
      leadTime: row.leadTime || undefined,
      imageUrl: row.imageUrl || undefined,
      status,
    }));
  };

  const handlePublish = () => {
    const payload = buildPayload("Published");
    if (payload.length === 0) {
      setToast("Select at least one item before publishing.");
      setTimeout(() => setToast(null), 3000);
      return;
    }
    saveMutation.mutate({ products: payload, status: "Published" });
  };

  const handleSaveAsDraft = () => {
    const payload = buildPayload("Draft");
    if (payload.length === 0) {
      setToast("Select at least one item to save.");
      setTimeout(() => setToast(null), 3000);
      return;
    }
    saveMutation.mutate({ products: payload, status: "Draft" });
  };

  const handleRowChange = (id: number, field: keyof UploadRow, value: string) => {
    setRows((current) => current.map((row) => (row.id === id ? { ...row, [field]: value } : row)));
  };

  const toggleItem = (id: number) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div>
      <h1 className="font-display text-2xl font-extrabold text-navy">Upload Supplier Catalogue</h1>
      <p className="mt-1 text-sm text-mutedink">Upload a supplier PDF and review the extracted product suggestions before publishing them.</p>

      {stage === "idle" && (
        <div className="mt-8 max-w-3xl space-y-6">
          <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-ocean/50 bg-white px-6 py-14 text-center hover:border-ocean">
            <input type="file" accept="application/pdf" className="hidden" onChange={(e) => handleFileChange(e.target.files?.[0] ?? null)} />
            <UploadCloud className="h-12 w-12 text-navy" />
            <div className="mt-4 font-display text-base font-bold text-navy">Drag & drop a supplier PDF catalogue here</div>
            <div className="mt-1 text-xs text-mutedink">or click to browse · PDF only · max 50MB</div>
            {selectedFile && <div className="mt-3 text-xs font-semibold text-ocean">{selectedFile.name}</div>}
            <span className="mt-4 rounded-md border border-navy px-4 py-2 text-xs font-semibold text-navy">Browse File</span>
          </label>

          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Supplier Name" placeholder="Guangdong Elite Ceramics" readOnly value="" />
            <SelectField
              label="Default Category (fallback when AI can't classify)"
              options={CATEGORIES}
              value={defaultCategory}
              onChange={(e) => setDefaultCategory(e.target.value)}
            />
            <Field label="Default Origin" defaultValue="🇨🇳 China" readOnly />
          </div>

          {error && <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

          <button type="button" disabled={uploadMutation.isPending} onClick={() => uploadMutation.mutate()} className="rounded-md bg-navy px-6 py-3 text-sm font-semibold text-white hover:bg-[#1A5491] disabled:cursor-not-allowed disabled:opacity-60">
            {uploadMutation.isPending ? "Uploading…" : "Upload & Extract →"}
          </button>
        </div>
      )}

      {stage === "uploading" && (
        <div className="mt-10 max-w-2xl rounded-xl border border-border bg-white p-10 text-center">
          <Loader2 className="mx-auto h-10 w-10 animate-spin text-navy" />
          <div className="mt-4 font-display text-lg font-bold text-navy">Extracting products from PDF…</div>
          <div className="mt-6 h-2 w-full overflow-hidden rounded-full bg-offwhite">
            <div className="h-full w-full bg-gradient-to-r from-ocean to-navy animate-pulse" />
          </div>
          <div className="mt-4 text-sm text-charcoal">Reading document text. If this is a scanned PDF, OCR will run automatically — this may take up to 30 seconds.</div>
          <div className="mt-3 flex items-center justify-center gap-2 text-xs text-mutedink">
            <FileText className="h-3.5 w-3.5" /> Hybrid OCR engine active
          </div>
        </div>
      )}

      {stage === "review" && (
        <div className="mt-8">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="font-display text-xl font-extrabold text-navy">Review extracted products</h2>
              <p className="mt-1 text-sm text-mutedink">Edit fields before publishing them to the live catalogue.</p>
            </div>
            <div className="text-xs font-mono-data text-mutedink">{selected.size} of {rows.length} selected</div>
          </div>

          <div className="mt-5 overflow-hidden rounded-xl border border-border bg-white">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-offwhite text-mutedink">
                  <tr>
                    <th className="px-3 py-2"><input type="checkbox" checked={rows.length > 0 && selected.size === rows.length} onChange={(event) => setSelected(event.target.checked ? new Set(rows.map((row) => row.id)) : new Set())} /></th>
                    <th className="px-3 py-2">Image</th>
                    <th className="px-3 py-2">Product Name</th>
                    <th className="px-3 py-2">Category</th>
                    <th className="px-3 py-2">Supplier</th>
                    <th className="px-3 py-2">FOB Price</th>
                    <th className="px-3 py-2">Lead Time</th>
                    <th className="px-3 py-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id} className="border-t border-border align-middle">
                      <td className="px-3 py-2"><input type="checkbox" checked={selected.has(row.id)} onChange={() => toggleItem(row.id)} /></td>
                      <td className="px-3 py-2">
                        {row.imageUrl ? (
                          <img src={apiUrl(row.imageUrl)} alt="" className="h-9 w-12 rounded object-cover border border-border" />
                        ) : (
                          <div className="h-9 w-12 rounded bg-secondary grid place-items-center text-[10px] text-mutedink font-medium">No img</div>
                        )}
                      </td>
                      <td className="px-3 py-2"><input value={row.name} onChange={(event) => handleRowChange(row.id, "name", event.target.value)} className="w-72 rounded border border-transparent bg-transparent px-2 py-1 hover:border-input focus:border-ocean focus:bg-white focus:outline-none" /></td>
                      <td className="px-3 py-2">
                        <select
                          value={row.category}
                          onChange={(event) => handleRowChange(row.id, "category", event.target.value)}
                          className="w-40 rounded border border-transparent bg-transparent px-2 py-1 text-xs hover:border-input focus:border-ocean focus:bg-white focus:outline-none"
                        >
                          {CATEGORIES.map((cat) => (
                            <option key={cat} value={cat}>{cat}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-3 py-2"><input value={row.supplier} onChange={(event) => handleRowChange(row.id, "supplier", event.target.value)} className="w-40 rounded border border-transparent bg-transparent px-2 py-1 hover:border-input focus:border-ocean focus:bg-white focus:outline-none" /></td>
                      <td className="px-3 py-2"><input value={row.fobPrice} onChange={(event) => handleRowChange(row.id, "fobPrice", event.target.value)} className="w-24 rounded border border-transparent bg-transparent px-2 py-1 hover:border-input focus:border-ocean focus:bg-white focus:outline-none" /></td>
                      <td className="px-3 py-2"><input value={row.leadTime} onChange={(event) => handleRowChange(row.id, "leadTime", event.target.value)} className="w-28 rounded border border-transparent bg-transparent px-2 py-1 hover:border-input focus:border-ocean focus:bg-white focus:outline-none" /></td>
                      <td className="px-3 py-2"><span className="rounded bg-secondary/10 px-2 py-0.5 text-[10px] font-semibold text-navy">{row.status}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-3">
            <button
              onClick={handlePublish}
              disabled={saveMutation.isPending}
              className="inline-flex items-center gap-2 rounded-md bg-navy px-6 py-3 text-sm font-semibold text-white hover:bg-[#1A5491] disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <Globe className="h-4 w-4" />
              {saveMutation.isPending ? "Saving…" : "Publish Selected"}
            </button>
            <button
              onClick={handleSaveAsDraft}
              disabled={saveMutation.isPending}
              className="inline-flex items-center gap-2 rounded-md border border-navy px-6 py-3 text-sm font-semibold text-navy hover:bg-navy hover:text-white disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <FileText className="h-4 w-4" />
              Save as Draft
            </button>
            <button
              onClick={() => { setStage("idle"); setRows([]); setSelected(new Set()); setSelectedFile(null); }}
              className="rounded-md border border-input px-6 py-3 text-sm font-semibold text-charcoal hover:bg-slate-50"
            >
              Upload Another
            </button>
          </div>

          {toast && <div className="fixed bottom-6 right-6 z-50 rounded-md bg-green px-4 py-3 text-sm font-semibold text-white shadow-lg">{toast}</div>}
        </div>
      )}
    </div>
  );
}

// ─── Product Catalogue Page ────────────────────────────────────────────────────
const PRODUCT_STATUS_TABS = ["All", "Published", "Draft", "Needs Review"] as const;
type ProductStatusTab = typeof PRODUCT_STATUS_TABS[number];

// ─── Product Validation Helpers ───────────────────────────────────────────────
function validateProductName(v: string): string | null {
  const s = v.trim();
  if (!s) return "Product name is required.";
  if (s.length < 2) return "Product name must be at least 2 characters.";
  if (s.length > 150) return "Product name must be 150 characters or fewer.";
  return null;
}

function validateSupplierName(v: string): string | null {
  const s = v.trim();
  if (!s) return "Supplier name is required.";
  if (s.length < 2) return "Supplier name must be at least 2 characters.";
  if (s.length > 100) return "Supplier name must be 100 characters or fewer.";
  return null;
}

function validateFobPrice(v: string): string | null {
  const s = v.trim();
  if (!s) return "FOB price is required.";
  if (s.length < 2) return "Please enter a valid price (e.g. $120 / sqm or POA).";
  return null;
}

function validateCategory(v: string): string | null {
  if (!v || !v.trim()) return "Category is required.";
  return null;
}

function validateImageFile(file: File | null, existingUrl?: string | null): string | null {
  if (!file && !existingUrl) return "Product image is required.";
  if (!file) return null;
  const allowed = ["image/jpeg", "image/png", "image/webp", "image/gif"];
  if (!allowed.includes(file.type)) return "Only JPEG, PNG, WEBP, and GIF images are allowed.";
  if (file.size > 10 * 1024 * 1024) return "Image size exceeds 10 MB limit.";
  return null;
}

function CataloguePage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusTab, setStatusTab] = useState<ProductStatusTab>("All");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editValues, setEditValues] = useState<Partial<ProductCreateInput>>({});
  const [viewingProduct, setViewingProduct] = useState<Product | null>(null);
  const [newProduct, setNewProduct] = useState<ProductCreateInput>({
    name: "",
    category: "Tiles & Flooring",
    supplier: "",
    fobPrice: "",
    leadTime: "",
    imageUrl: null,
    status: "Draft",
  });
  const [createTouched, setCreateTouched] = useState<Record<string, boolean>>({});
  const [imageError, setImageError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  // ─── Image picker state ────────────────────────────────────────────────────
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageUploading, setImageUploading] = useState(false);
  const [imageDragOver, setImageDragOver] = useState(false);

  // ─── Real-time validation computation ──────────────────────────────────────
  const createErrors = useMemo(() => ({
    name: validateProductName(newProduct.name),
    supplier: validateSupplierName(newProduct.supplier),
    fobPrice: validateFobPrice(newProduct.fobPrice),
    category: validateCategory(newProduct.category),
    image: validateImageFile(imageFile, newProduct.imageUrl),
  }), [newProduct, imageFile]);

  const isCreateValid = Object.values(createErrors).every((e) => e === null);

  const handleTouchField = (field: string) => {
    setCreateTouched((prev) => ({ ...prev, [field]: true }));
  };

  const touchAllCreateFields = () => {
    setCreateTouched({ name: true, supplier: true, fobPrice: true, category: true, image: true });
  };

  const handleImageSelect = (file: File | null) => {
    if (!file) return;
    const err = validateImageFile(file);
    if (err) {
      setImageError(err);
      return;
    }
    setImageError(null);
    setImageFile(file);
    const reader = new FileReader();
    reader.onload = (e) => setImagePreview(e.target?.result as string);
    reader.readAsDataURL(file);
  };

  const clearImage = () => {
    setImageFile(null);
    setImagePreview(null);
    setImageError(null);
    setNewProduct((prev) => ({ ...prev, imageUrl: null }));
  };

  const productsQuery = useQuery<Product[]>({
    queryKey: ["products"],
    queryFn: () => apiFetch<Product[]>("/api/products"),
  });

  const createMutation = useMutation({
    mutationFn: async (product: ProductCreateInput) => apiFetch<Product>("/api/products", { method: "POST", body: JSON.stringify(product) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["products", "published"] });
      setShowCreate(false);
      setNewProduct({ name: "", category: "Tiles & Flooring", supplier: "", fobPrice: "", leadTime: "", imageUrl: null, status: "Draft" });
      setCreateTouched({});
      clearImage();
      setToast("Product created successfully.");
      setTimeout(() => setToast(null), 3000);
    },
  });

  const handleCreateProduct = async () => {
    touchAllCreateFields();
    if (!isCreateValid) {
      setToast("Please fix all validation errors before saving.");
      setTimeout(() => setToast(null), 3000);
      return;
    }

    let finalImageUrl: string | null = newProduct.imageUrl ?? null;
    if (imageFile) {
      setImageUploading(true);
      try {
        const fd = new FormData();
        fd.append("image", imageFile);
        const res = await fetch(apiUrl("/api/upload/image"), { method: "POST", body: fd });
        if (!res.ok) throw new Error("Upload failed");
        const json = await res.json() as { imageUrl: string };
        finalImageUrl = json.imageUrl;
      } catch {
        setToast("Image upload failed. Please try again.");
        setTimeout(() => setToast(null), 3000);
        return;
      } finally {
        setImageUploading(false);
      }
    }
    createMutation.mutate({ ...newProduct, imageUrl: finalImageUrl });
  };

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<ProductCreateInput> }) => apiFetch<Product>(`/api/products/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      setEditingId(null);
      setEditValues({});
      setToast("Product updated successfully.");
      setTimeout(() => setToast(null), 3000);
    },
  });

  const statusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) =>
      apiFetch<Product>(`/api/products/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) }),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["products", "published"] });
      const label = updated.status === "Published" ? "published" : updated.status === "Draft" ? "set to Draft" : "updated";
      setToast(`Product ${label} successfully.`);
      setTimeout(() => setToast(null), 3000);
    },
    onError: () => {
      setToast("Failed to update product status.");
      setTimeout(() => setToast(null), 3000);
    },
  });

  // Status counts for tabs
  const statusCounts = useMemo(() => {
    const all = productsQuery.data ?? [];
    return PRODUCT_STATUS_TABS.reduce((acc, s) => {
      acc[s] = s === "All" ? all.length : all.filter((p) => p.status === s).length;
      return acc;
    }, {} as Record<ProductStatusTab, number>);
  }, [productsQuery.data]);

  const filteredProducts = useMemo(() => {
    const term = search.toLowerCase();
    return (productsQuery.data ?? []).filter((product) => {
      if (statusTab !== "All" && product.status !== statusTab) return false;
      return (
        product.name.toLowerCase().includes(term) ||
        product.category.toLowerCase().includes(term) ||
        product.supplier.toLowerCase().includes(term) ||
        product.status.toLowerCase().includes(term)
      );
    });
  }, [productsQuery.data, search, statusTab]);

  const handleSave = (id: number) => {
    updateMutation.mutate({ id, data: editValues });
  };

  // CATEGORIES is defined at the top of this file — shared across all admin sections

  return (
    <div>
      {viewingProduct && (
        <ProductViewModal product={viewingProduct} onClose={() => setViewingProduct(null)} />
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-extrabold text-navy">Product Catalogue</h1>
          <p className="mt-1 text-sm text-mutedink">Manage product listings and publish updates.</p>
        </div>
        <button onClick={() => setShowCreate((prev) => !prev)} className="inline-flex items-center gap-2 rounded-md bg-navy px-4 py-2 text-sm font-semibold text-white hover:bg-[#1A5491]">
          <Upload className="h-4 w-4" /> {showCreate ? "Close form" : "Create Product"}
        </button>
      </div>

      {showCreate && (
        <div className="mt-5 rounded-xl border border-border bg-white p-6 shadow-sm">
          <h2 className="mb-5 font-display text-lg font-bold text-navy">New Product</h2>

          {/* Image Picker */}
          <div className="mb-5">
            <span className="block text-xs font-semibold uppercase tracking-wider text-mutedink">
              Product Image <span className="text-red-500">*</span>
            </span>
            <div
              onDragOver={(e) => { e.preventDefault(); setImageDragOver(true); }}
              onDragLeave={() => setImageDragOver(false)}
              onDrop={(e) => { e.preventDefault(); setImageDragOver(false); handleImageSelect(e.dataTransfer.files[0] ?? null); }}
              className={`mt-1 relative flex min-h-[140px] cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed transition-colors ${
                (createTouched.image || imageError) && createErrors.image
                  ? "border-red-400 bg-red-50/20"
                  : imageDragOver
                  ? "border-ocean bg-ocean/5"
                  : imagePreview
                  ? "border-ocean/40 bg-offwhite"
                  : "border-input bg-white hover:border-ocean/60"
              }`}
            >
              {imagePreview ? (
                <>
                  <img src={imagePreview} alt="Preview" className="h-full max-h-[280px] w-full rounded-xl object-cover" />
                  <button
                    type="button"
                    onClick={clearImage}
                    className="absolute right-2 top-2 rounded-full bg-black/60 p-1 text-white hover:bg-black/80"
                    title="Remove image"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </>
              ) : (
                <label className="flex w-full cursor-pointer flex-col items-center justify-center gap-2 p-6 text-center">
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    className="hidden"
                    onChange={(e) => handleImageSelect(e.target.files?.[0] ?? null)}
                  />
                  <UploadCloud className="h-10 w-10 text-navy/40" />
                  <span className="text-sm font-semibold text-navy">Drag & drop or click to upload</span>
                  <span className="text-xs text-mutedink">JPEG, PNG, WEBP, GIF · max 10 MB</span>
                </label>
              )}
            </div>
            {((createTouched.image || imageError) && createErrors.image) && (
              <div className="mt-2 flex items-center gap-1.5 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{createErrors.image}</span>
              </div>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {/* Product Name */}
            <div className="flex flex-col gap-1">
              <span className="block text-xs font-semibold uppercase tracking-wider text-mutedink">
                Product Name <span className="text-red-500">*</span>
              </span>
              <input
                type="text"
                placeholder="e.g. Carrara White Porcelain Tile"
                value={newProduct.name}
                onChange={(e) => setNewProduct((prev) => ({ ...prev, name: e.target.value }))}
                onBlur={() => handleTouchField("name")}
                className={`w-full rounded-md border px-3 py-2.5 text-sm outline-none transition-colors bg-white ${
                  createTouched.name && createErrors.name
                    ? "border-red-400 focus:border-red-500 bg-red-50/30"
                    : newProduct.name.trim() && !createErrors.name
                    ? "border-green/60 focus:border-green"
                    : "border-input focus:border-ocean"
                }`}
              />
              {createTouched.name && createErrors.name && (
                <span className="flex items-center gap-1 text-xs text-red-600">
                  <AlertCircle className="h-3 w-3 shrink-0" />
                  {createErrors.name}
                </span>
              )}
            </div>

            {/* Supplier */}
            <div className="flex flex-col gap-1">
              <span className="block text-xs font-semibold uppercase tracking-wider text-mutedink">
                Supplier <span className="text-red-500">*</span>
              </span>
              <input
                type="text"
                placeholder="e.g. Guangdong Elite Ceramics"
                value={newProduct.supplier}
                onChange={(e) => setNewProduct((prev) => ({ ...prev, supplier: e.target.value }))}
                onBlur={() => handleTouchField("supplier")}
                className={`w-full rounded-md border px-3 py-2.5 text-sm outline-none transition-colors bg-white ${
                  createTouched.supplier && createErrors.supplier
                    ? "border-red-400 focus:border-red-500 bg-red-50/30"
                    : newProduct.supplier.trim() && !createErrors.supplier
                    ? "border-green/60 focus:border-green"
                    : "border-input focus:border-ocean"
                }`}
              />
              {createTouched.supplier && createErrors.supplier && (
                <span className="flex items-center gap-1 text-xs text-red-600">
                  <AlertCircle className="h-3 w-3 shrink-0" />
                  {createErrors.supplier}
                </span>
              )}
            </div>

            {/* FOB Price */}
            <div className="flex flex-col gap-1">
              <span className="block text-xs font-semibold uppercase tracking-wider text-mutedink">
                FOB Price <span className="text-red-500">*</span>
              </span>
              <input
                type="text"
                placeholder="e.g. $120–$180 / sqm"
                value={newProduct.fobPrice}
                onChange={(e) => setNewProduct((prev) => ({ ...prev, fobPrice: e.target.value }))}
                onBlur={() => handleTouchField("fobPrice")}
                className={`w-full rounded-md border px-3 py-2.5 text-sm outline-none transition-colors bg-white ${
                  createTouched.fobPrice && createErrors.fobPrice
                    ? "border-red-400 focus:border-red-500 bg-red-50/30"
                    : newProduct.fobPrice.trim() && !createErrors.fobPrice
                    ? "border-green/60 focus:border-green"
                    : "border-input focus:border-ocean"
                }`}
              />
              {createTouched.fobPrice && createErrors.fobPrice && (
                <span className="flex items-center gap-1 text-xs text-red-600">
                  <AlertCircle className="h-3 w-3 shrink-0" />
                  {createErrors.fobPrice}
                </span>
              )}
            </div>

            {/* Lead Time (optional) */}
            <div className="flex flex-col gap-1">
              <span className="block text-xs font-semibold uppercase tracking-wider text-mutedink">
                Lead Time <span className="font-normal normal-case text-[10px] text-mutedink">(optional)</span>
              </span>
              <input
                type="text"
                placeholder="e.g. 4–6 weeks"
                value={newProduct.leadTime ?? ""}
                onChange={(e) => setNewProduct((prev) => ({ ...prev, leadTime: e.target.value }))}
                className="w-full rounded-md border border-input bg-white px-3 py-2.5 text-sm outline-none focus:border-ocean"
              />
            </div>

            {/* Category */}
            <div className="flex flex-col gap-1">
              <span className="block text-xs font-semibold uppercase tracking-wider text-mutedink">
                Category <span className="text-red-500">*</span>
              </span>
              <select
                value={newProduct.category}
                onChange={(e) => setNewProduct((prev) => ({ ...prev, category: e.target.value }))}
                onBlur={() => handleTouchField("category")}
                className="w-full rounded-md border border-input bg-white px-3 py-2.5 text-sm outline-none focus:border-ocean"
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            {/* Status */}
            <div className="flex flex-col gap-1">
              <span className="block text-xs font-semibold uppercase tracking-wider text-mutedink">
                Status <span className="text-red-500">*</span>
              </span>
              <select
                value={newProduct.status}
                onChange={(e) => setNewProduct((prev) => ({ ...prev, status: e.target.value }))}
                className="w-full rounded-md border border-input bg-white px-3 py-2.5 text-sm outline-none focus:border-ocean"
              >
                <option>Draft</option>
                <option>Published</option>
                <option>Needs Review</option>
              </select>
            </div>
          </div>

          {/* Inline warning banner when trying to submit invalid form */}
          {!isCreateValid && Object.values(createTouched).some(Boolean) && (
            <div className="mt-4 flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>Please fill in all required fields marked with * before saving.</span>
            </div>
          )}

          <div className="mt-5 flex gap-3">
            <button
              onClick={handleCreateProduct}
              disabled={createMutation.isPending || imageUploading}
              className={`inline-flex items-center gap-2 rounded-md px-5 py-2.5 text-sm font-semibold text-white transition-all ${
                !isCreateValid && Object.values(createTouched).some(Boolean)
                  ? "bg-red-300 cursor-not-allowed text-white"
                  : "bg-navy hover:bg-[#1A5491] disabled:cursor-not-allowed disabled:opacity-60"
              }`}
            >
              {(createMutation.isPending || imageUploading) && <Loader2 className="h-4 w-4 animate-spin" />}
              {imageUploading ? "Uploading image…" : createMutation.isPending ? "Saving…" : "Save Product"}
            </button>
            <button
              onClick={() => { setShowCreate(false); setCreateTouched({}); clearImage(); }}
              className="rounded-md border border-input px-5 py-2.5 text-sm font-semibold text-navy hover:bg-slate-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Status filter tabs */}
      <div className="mt-5 flex flex-wrap gap-2">
        {PRODUCT_STATUS_TABS.map((s) => (
          <button
            key={s}
            onClick={() => setStatusTab(s)}
            className={`inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-semibold transition-colors ${
              statusTab === s
                ? "bg-navy text-white"
                : "bg-white border border-input text-charcoal hover:border-navy hover:text-navy"
            }`}
          >
            {s}
            <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
              statusTab === s ? "bg-white/20 text-white" : "bg-offwhite text-mutedink"
            }`}>{statusCounts[s]}</span>
          </button>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[260px]">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-mutedink" />
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search products…" className="w-full rounded-md border border-input bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-ocean" />
        </div>
      </div>

      <div className="mt-5 overflow-hidden rounded-xl border border-border bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-offwhite text-xs text-mutedink">
            <tr>
              <th className="px-4 py-2.5">Product</th>
              <th className="px-4 py-2.5">Category</th>
              <th className="px-4 py-2.5">Supplier</th>
              <th className="px-4 py-2.5">FOB Price</th>
              <th className="px-4 py-2.5">Lead Time</th>
              <th className="px-4 py-2.5">Status</th>
              <th className="px-4 py-2.5">Actions</th>
            </tr>
          </thead>
          <tbody>
            {productsQuery.isLoading ? (
              <tr><td colSpan={7} className="px-4 py-6 text-center text-sm text-mutedink">Loading products…</td></tr>
            ) : filteredProducts.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-6 text-center text-sm text-mutedink">No products found.</td></tr>
            ) : filteredProducts.map((product) => (
              <tr key={product.id} className="border-t border-border">
                <td className="px-4 py-3">
                  {editingId === product.id ? (
                    <input className="w-full rounded border border-input px-2 py-1 text-sm" value={editValues.name ?? product.name} onChange={(event) => setEditValues((prev) => ({ ...prev, name: event.target.value }))} />
                  ) : (
                    <div className="font-medium text-navy">{product.name}</div>
                  )}
                </td>
                <td className="px-4 py-3 text-charcoal">
                  {editingId === product.id ? (
                    <select className="rounded border border-input px-2 py-1 text-sm" value={editValues.category ?? product.category} onChange={(event) => setEditValues((prev) => ({ ...prev, category: event.target.value }))}>
                      {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                    </select>
                  ) : product.category}
                </td>
                <td className="px-4 py-3 text-charcoal">
                  {editingId === product.id ? (
                    <input className="w-full rounded border border-input px-2 py-1 text-sm" value={editValues.supplier ?? product.supplier} onChange={(event) => setEditValues((prev) => ({ ...prev, supplier: event.target.value }))} />
                  ) : product.supplier}
                </td>
                <td className="px-4 py-3 font-mono-data text-charcoal">
                  {editingId === product.id ? (
                    <input className="w-full rounded border border-input px-2 py-1 text-sm" value={editValues.fobPrice ?? product.fobPrice} onChange={(event) => setEditValues((prev) => ({ ...prev, fobPrice: event.target.value }))} />
                  ) : product.fobPrice}
                </td>
                <td className="px-4 py-3 text-charcoal">
                  {editingId === product.id ? (
                    <input className="w-28 rounded border border-input px-2 py-1 text-sm" value={editValues.leadTime ?? product.leadTime ?? ""} onChange={(event) => setEditValues((prev) => ({ ...prev, leadTime: event.target.value }))} />
                  ) : (product.leadTime || <span className="text-mutedink">—</span>)}
                </td>
                <td className="px-4 py-3">
                  {editingId === product.id ? (
                    <select className="rounded border border-input px-2 py-1 text-sm" value={editValues.status ?? product.status} onChange={(event) => setEditValues((prev) => ({ ...prev, status: event.target.value }))}>
                      <option>Published</option>
                      <option>Draft</option>
                      <option>Needs Review</option>
                    </select>
                  ) : (
                    <span className={`rounded px-2 py-1 text-xs font-semibold ${PRODUCT_STATUS_STYLES[product.status] ?? "bg-secondary text-navy"}`}>
                      {product.status}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-2 text-mutedink">
                    {editingId === product.id ? (
                      <>
                        <button onClick={() => handleSave(product.id)} className="rounded-md bg-navy px-3 py-2 text-xs font-semibold text-white hover:bg-[#1A5491]">Save</button>
                        <button onClick={() => { setEditingId(null); setEditValues({}); }} className="rounded-md border border-input px-3 py-2 text-xs font-semibold text-navy hover:bg-slate-50">Cancel</button>
                      </>
                    ) : (
                      <>
                        {/* Quick publish / unpublish */}
                        {product.status !== "Published" ? (
                          <button
                            onClick={() => statusMutation.mutate({ id: product.id, status: "Published" })}
                            disabled={statusMutation.isPending}
                            className="inline-flex items-center gap-1 rounded-md bg-green/10 border border-green/30 px-3 py-2 text-xs font-semibold text-green hover:bg-green hover:text-white disabled:opacity-50"
                          >
                            <Globe className="h-3 w-3" /> Publish
                          </button>
                        ) : (
                          <button
                            onClick={() => statusMutation.mutate({ id: product.id, status: "Draft" })}
                            disabled={statusMutation.isPending}
                            className="inline-flex items-center gap-1 rounded-md bg-secondary border border-input px-3 py-2 text-xs font-semibold text-navy hover:bg-offwhite disabled:opacity-50"
                          >
                            <FileText className="h-3 w-3" /> Unpublish
                          </button>
                        )}
                        <button
                          onClick={() => { setEditingId(product.id); setEditValues({ name: product.name, category: product.category, supplier: product.supplier, fobPrice: product.fobPrice, leadTime: product.leadTime ?? "", status: product.status }); }}
                          className="inline-flex items-center gap-1 rounded-md border border-input px-3 py-2 text-xs font-semibold text-navy hover:bg-slate-50"
                        >
                          <Pencil className="h-3 w-3" /> Edit
                        </button>
                        <button
                          onClick={() => setViewingProduct(product)}
                          className="inline-flex items-center gap-1 rounded-md border border-input px-3 py-2 text-xs font-semibold text-navy hover:bg-slate-50"
                        >
                          <Eye className="h-3 w-3" /> View
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {toast && <div className="fixed bottom-6 right-6 z-50 rounded-md bg-green px-4 py-3 text-sm font-semibold text-white shadow-lg">{toast}</div>}
    </div>
  );
}

// ─── Enquiries Page ────────────────────────────────────────────────────────────
const ENQUIRY_STATUSES = ["All", "New", "In Progress", "Quoted", "Closed"] as const;
type EnquiryStatus = typeof ENQUIRY_STATUSES[number];

type AttachmentItem = {
  name: string;
  url: string;
  size?: number;
};

function parseAttachments(raw?: string | null): AttachmentItem[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed;
  } catch {}
  if (typeof raw === "string" && raw.trim()) {
    return [{ name: "Attached Document", url: raw.trim() }];
  }
  return [];
}

function formatFileSizeAdmin(bytes?: number): string {
  if (!bytes) return "";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function EnquiriesPage() {
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState<number | null>(null);
  const [statusValue, setStatusValue] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<EnquiryStatus>("All");
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const enquiriesQuery = useQuery<Enquiry[]>({
    queryKey: ["enquiries"],
    queryFn: () => apiFetch<Enquiry[]>("/api/enquiries"),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => apiFetch<Enquiry>(`/api/enquiries/${id}`, { method: "PUT", body: JSON.stringify({ status }) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["enquiries"] });
      setEditingId(null);
      setToast("Enquiry status updated.");
      setTimeout(() => setToast(null), 3000);
    },
    onError: () => {
      setToast("Failed to update enquiry.");
      setTimeout(() => setToast(null), 3000);
    },
  });

  const filteredEnquiries = useMemo(() => {
    const all = enquiriesQuery.data ?? [];
    if (filterStatus === "All") return all;
    return all.filter((e) => e.status === filterStatus);
  }, [enquiriesQuery.data, filterStatus]);

  const statusCounts = useMemo(() => {
    const all = enquiriesQuery.data ?? [];
    return ENQUIRY_STATUSES.reduce((acc, s) => {
      acc[s] = s === "All" ? all.length : all.filter((e) => e.status === s).length;
      return acc;
    }, {} as Record<EnquiryStatus, number>);
  }, [enquiriesQuery.data]);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-extrabold text-navy">Enquiries</h1>
          <p className="mt-1 text-sm text-mutedink">Customer sourcing requests submitted via the website.</p>
        </div>
        <div className="rounded-md bg-slate-50 px-4 py-2 text-sm text-slate-700">
          Total: {enquiriesQuery.data?.length ?? 0}
        </div>
      </div>

      {/* Status filter tabs */}
      <div className="mt-5 flex flex-wrap gap-2">
        {ENQUIRY_STATUSES.map((s) => (
          <button
            key={s}
            onClick={() => setFilterStatus(s)}
            className={`inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-semibold transition-colors ${
              filterStatus === s
                ? "bg-navy text-white"
                : "bg-white border border-input text-charcoal hover:border-navy hover:text-navy"
            }`}
          >
            {s}
            <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${filterStatus === s ? "bg-white/20 text-white" : "bg-offwhite text-mutedink"}`}>
              {statusCounts[s]}
            </span>
          </button>
        ))}
      </div>

      <div className="mt-4 overflow-hidden rounded-xl border border-border bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-offwhite text-xs text-mutedink">
            <tr>
              <th className="px-4 py-2.5">Reference</th>
              <th className="px-4 py-2.5">Name</th>
              <th className="px-4 py-2.5">Company</th>
              <th className="px-4 py-2.5">Role</th>
              <th className="px-4 py-2.5">Products</th>
              <th className="px-4 py-2.5">Contact</th>
              <th className="px-4 py-2.5">Submitted</th>
              <th className="px-4 py-2.5">Status</th>
              <th className="px-4 py-2.5">Actions</th>
            </tr>
          </thead>
          <tbody>
            {enquiriesQuery.isLoading ? (
              <tr><td colSpan={9} className="px-4 py-6 text-center text-sm text-mutedink">Loading enquiries…</td></tr>
            ) : filteredEnquiries.length === 0 ? (
              <tr><td colSpan={9} className="px-4 py-6 text-center text-sm text-mutedink">No enquiries found.</td></tr>
            ) : filteredEnquiries.map((enquiry) => (
              <>
                <tr key={enquiry.id} className="border-t border-border hover:bg-offwhite">
                  <td className="px-4 py-3 font-mono-data text-xs text-navy">{enquiry.reference}</td>
                  <td className="px-4 py-3 font-medium text-navy">{enquiry.name}</td>
                  <td className="px-4 py-3 text-charcoal">{enquiry.company}</td>
                  <td className="px-4 py-3 text-charcoal">{enquiry.role}</td>
                  <td className="px-4 py-3 max-w-[160px] truncate text-charcoal" title={enquiry.items}>{enquiry.items}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-0.5">
                      {enquiry.email && (
                        <a href={`mailto:${enquiry.email}`} className="flex items-center gap-1 text-xs text-ocean hover:underline">
                          <Mail className="h-3 w-3" />{enquiry.email}
                        </a>
                      )}
                      {enquiry.phone && (
                        <a href={`tel:${enquiry.phone}`} className="flex items-center gap-1 text-xs text-charcoal hover:underline">
                          <Phone className="h-3 w-3" />{enquiry.phone}
                        </a>
                      )}
                      {!enquiry.email && !enquiry.phone && <span className="text-xs text-mutedink">—</span>}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-mutedink">{new Date(enquiry.submittedAt).toLocaleDateString()}</td>
                  <td className="px-4 py-3">
                    {editingId === enquiry.id ? (
                      <select className="rounded-md border border-input bg-white px-2 py-1 text-sm" value={statusValue} onChange={(event) => setStatusValue(event.target.value)}>
                        <option>New</option>
                        <option>In Progress</option>
                        <option>Quoted</option>
                        <option>Closed</option>
                      </select>
                    ) : (
                      <span className={`rounded px-2 py-0.5 text-[10px] font-semibold ${ENQUIRY_STATUS_STYLES[enquiry.status] ?? "bg-secondary text-mutedink"}`}>
                        {enquiry.status}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      {editingId === enquiry.id ? (
                        <>
                          <button onClick={() => updateMutation.mutate({ id: enquiry.id, status: statusValue })} className="rounded-md bg-navy px-3 py-2 text-xs font-semibold text-white hover:bg-[#1A5491]">Save</button>
                          <button onClick={() => setEditingId(null)} className="rounded-md border border-input px-3 py-2 text-xs font-semibold text-navy hover:bg-slate-50">Cancel</button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => { setEditingId(enquiry.id); setStatusValue(enquiry.status); }}
                            className="inline-flex items-center gap-1 rounded-md border border-input px-3 py-2 text-xs font-semibold text-navy hover:bg-slate-50"
                          >
                            <Pencil className="h-3 w-3" /> Edit
                          </button>
                          <button
                            onClick={() => setExpandedId(expandedId === enquiry.id ? null : enquiry.id)}
                            className="inline-flex items-center gap-1 rounded-md border border-input px-3 py-2 text-xs font-semibold text-navy hover:bg-slate-50"
                          >
                            {expandedId === enquiry.id ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />} View
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>

                {/* Expanded message row */}
                {expandedId === enquiry.id && (
                  <tr key={`${enquiry.id}-expanded`} className="border-t border-border bg-offwhite">
                    <td colSpan={9} className="px-6 py-4">
                      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wider text-mutedink">Message / Requirements</p>
                          <p className="mt-1 whitespace-pre-line text-sm text-navy">{enquiry.message || "—"}</p>
                        </div>
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wider text-mutedink">Items Requested</p>
                          <p className="mt-1 text-sm text-navy">{enquiry.items}</p>
                        </div>
                        <div className="space-y-3">
                          {enquiry.email && (
                            <div>
                              <p className="text-xs font-semibold uppercase tracking-wider text-mutedink">Email</p>
                              <a href={`mailto:${enquiry.email}`} className="mt-1 text-sm text-ocean hover:underline">{enquiry.email}</a>
                            </div>
                          )}
                          {enquiry.phone && (
                            <div>
                              <p className="text-xs font-semibold uppercase tracking-wider text-mutedink">Phone / WhatsApp</p>
                              <a href={`tel:${enquiry.phone}`} className="mt-1 text-sm text-navy hover:underline">{enquiry.phone}</a>
                            </div>
                          )}
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-wider text-mutedink">Submitted</p>
                            <p className="mt-1 font-mono-data text-xs text-charcoal">{new Date(enquiry.submittedAt).toLocaleString()}</p>
                          </div>
                        </div>

                        {/* Uploaded Documents / Attachments section */}
                        {parseAttachments(enquiry.attachments).length > 0 && (
                          <div className="sm:col-span-2 lg:col-span-3 border-t border-border/80 pt-4 mt-2">
                            <p className="text-xs font-semibold uppercase tracking-wider text-mutedink mb-2">
                              Uploaded Documents / Attachments ({parseAttachments(enquiry.attachments).length})
                            </p>
                            <div className="flex flex-wrap gap-3">
                              {parseAttachments(enquiry.attachments).map((att, idx) => {
                                const fileUrl = att.url.startsWith("http") ? att.url : apiUrl(att.url);
                                const isImage = /\.(jpg|jpeg|png|webp|gif|svg)$/i.test(att.name || att.url);
                                const ext = ((att.name || att.url).split(".").pop() || "FILE").toUpperCase();

                                return (
                                  <a
                                    key={idx}
                                    href={fileUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="group flex items-center gap-3 rounded-lg border border-border bg-white p-2.5 text-xs font-medium text-navy hover:border-ocean hover:bg-slate-50 transition-all shadow-sm max-w-xs"
                                  >
                                    {isImage ? (
                                      <img src={fileUrl} alt={att.name} className="h-10 w-10 rounded object-cover border border-border shrink-0" />
                                    ) : (
                                      <div className="grid h-10 w-10 shrink-0 place-items-center rounded bg-ocean/10 text-ocean font-bold font-mono text-[10px]">
                                        {ext.slice(0, 4)}
                                      </div>
                                    )}
                                    <div className="min-w-0 flex-1">
                                      <div className="truncate font-semibold text-navy group-hover:text-ocean" title={att.name}>
                                        {att.name || "Attachment"}
                                      </div>
                                      <div className="text-[10px] text-mutedink flex items-center gap-1 font-mono">
                                        {att.size ? formatFileSizeAdmin(att.size) : "Click to view"}
                                        <ExternalLink className="h-3 w-3 inline text-ocean ml-1" />
                                      </div>
                                    </div>
                                  </a>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table>
      </div>

      {toast && <div className="fixed bottom-6 right-6 z-50 rounded-md bg-green px-4 py-3 text-sm font-semibold text-white shadow-lg">{toast}</div>}
    </div>
  );
}

// ─── Shared UI ─────────────────────────────────────────────────────────────────
function PlaceholderBlock({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="rounded-xl border border-dashed border-border bg-white p-10 text-center">
      <h1 className="font-display text-2xl font-extrabold text-navy">{title}</h1>
      <p className="mt-2 text-sm text-mutedink">{desc}</p>
    </div>
  );
}

function Field({ label, ...rest }: { label: string } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="block">
      <span className="block text-xs font-semibold uppercase tracking-wider text-mutedink">{label}</span>
      <input {...rest} className="mt-1 w-full rounded-md border border-input bg-white px-3 py-2.5 text-sm outline-none focus:border-ocean" />
    </label>
  );
}

function SelectField({ label, options, value, onChange }: { label: string; options: string[]; value?: string; onChange?: ChangeEventHandler<HTMLSelectElement> }) {
  return (
    <label className="block">
      <span className="block text-xs font-semibold uppercase tracking-wider text-mutedink">{label}</span>
      <select value={value} onChange={onChange} className="mt-1 w-full rounded-md border border-input bg-white px-3 py-2.5 text-sm outline-none focus:border-ocean">
        {options.map((option) => <option key={option} value={option}>{option}</option>)}
      </select>
    </label>
  );
}
