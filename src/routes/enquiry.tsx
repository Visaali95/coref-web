import { createFileRoute, Link } from "@tanstack/react-router";
import { useRef, useState, useMemo } from "react";
import { CheckCircle2, X } from "lucide-react";
import { useEnquiry } from "@/lib/enquiry";
import { apiFetch } from "@/lib/api";

export const Route = createFileRoute("/enquiry")({
  head: () => ({
    meta: [
      { title: "Start an Enquiry — Coref" },
      { name: "description", content: "Submit a sourcing request. Coref reviews within 2 hours and returns a supplier shortlist within 24." },
    ],
  }),
  component: EnquiryPage,
});

function EnquiryPage() {
  const { items, remove } = useEnquiry();
  const [submitted, setSubmitted] = useState(false);
  const [reference, setReference] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const prefill = useMemo(
    () => (items.length ? items.map((i) => `- ${i.name} (${i.spec ?? ""}) · ${i.origin ?? ""}`).join("\n") : ""),
    [items],
  );

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const fd = new FormData(e.currentTarget);
    const payload = {
      name: fd.get("name") as string,
      company: fd.get("company") as string,
      role: fd.get("role") as string,
      email: fd.get("email") as string,
      phone: fd.get("whatsapp") as string,
      items: items.length
        ? items.map((i) => i.name).join(", ")
        : ((fd.get("sourcing") as string) || "General enquiry"),
      message: [
        fd.get("sourcing") as string,
        fd.get("qty") ? `Quantity: ${fd.get("qty")}` : "",
        fd.get("timeline") ? `Timeline: ${fd.get("timeline")}` : "",
        fd.get("destination") ? `Destination: ${fd.get("destination")}` : "",
        fd.get("source") ? `Source: ${fd.get("source")}` : "",
      ]
        .filter(Boolean)
        .join("\n"),
    };

    try {
      const result = await apiFetch<{ reference: string }>("/api/enquiries", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      setReference(result.reference);
      setSubmitted(true);
    } catch (err) {
      setError((err as Error).message || "Failed to submit enquiry. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-20 text-center sm:px-6">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-green/10">
          <CheckCircle2 className="h-9 w-9 text-green" />
        </div>
        <h1 className="mt-6 font-display text-3xl font-extrabold text-navy">Enquiry received.</h1>
        <p className="mt-2 text-charcoal">Our team will contact you within 24 hours via WhatsApp and email.</p>
        <div className="mt-6 inline-block rounded-md bg-offwhite px-4 py-2 font-mono-data text-sm">
          Reference: <span className="font-semibold text-navy">{reference}</span>
        </div>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <button onClick={() => { setSubmitted(false); setReference(""); formRef.current?.reset(); }} className="rounded-md border border-navy px-5 py-2.5 text-sm font-semibold text-navy hover:bg-navy hover:text-white">Submit Another Enquiry</button>
          <Link to="/products/tiles-flooring" className="rounded-md bg-navy px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#1A5491]">Browse More Products</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <div className="grid overflow-hidden rounded-2xl border border-border shadow-sm lg:grid-cols-[2fr_3fr]">
        {/* Left */}
        <aside className="bg-navy p-8 text-white sm:p-10">
          <h1 className="font-display text-3xl font-extrabold">Start your sourcing journey</h1>
          <p className="mt-3 text-sm text-white/70">Tell us what you're sourcing and where it needs to land. We'll handle the rest.</p>

          <div className="mt-8 space-y-3">
            <div className="text-xs font-semibold uppercase tracking-wider text-ocean">What happens next</div>
            {[
              "Coref reviews your requirement within 2 hours",
              "Supplier shortlist within 24 hours",
              "Samples dispatched within 7 days if requested",
            ].map((s) => (
              <div key={s} className="flex items-start gap-2 text-sm">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green" />
                <span className="text-white/90">{s}</span>
              </div>
            ))}
          </div>

          <div className="mt-10 space-y-1 text-sm">
            <div className="text-xs font-semibold uppercase tracking-wider text-ocean">Direct contact</div>
            <div className="text-white/90">hello@coref.in</div>
            <div className="text-white/90">+91 22 4000 1200</div>
            <div className="text-white/90">WhatsApp: +91 98200 12000</div>
          </div>

          <div className="mt-10 rounded-lg border border-white/10 bg-white/5 p-4 text-xs text-white/70">
            We handle <span className="font-mono-data font-semibold text-white">50+</span> sourcing requests every week.
          </div>

          {items.length > 0 && (
            <div className="mt-8">
              <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-ocean">Your enquiry list ({items.length})</div>
              <ul className="space-y-2">
                {items.map((i) => (
                  <li key={i.id} className="flex items-center justify-between gap-2 rounded-md border border-white/10 bg-white/5 p-2 text-xs">
                    <span className="truncate">{i.name}</span>
                    <button onClick={() => remove(i.id)} className="text-white/60 hover:text-white"><X className="h-3.5 w-3.5" /></button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </aside>

        {/* Form */}
        <form
          ref={formRef}
          className="bg-white p-8 sm:p-10"
          onSubmit={handleSubmit}
        >
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Full Name" name="name" required />
            <Field label="Company Name" name="company" required />

            <SelectField label="Your Role" name="role" options={["Architect", "Interior Designer", "Builder", "Developer", "Machinery Buyer", "Business Owner", "Other"]} />
            <Field label="Email" name="email" type="email" required />

            <Field label="WhatsApp Number" name="whatsapp" placeholder="🇮🇳 +91 ..." />
            <SelectField label="Destination" name="destination" options={["Mumbai", "Delhi", "Chennai", "Bangalore", "Hyderabad", "Pune", "Other"]} />
          </div>

          <div className="mt-5">
            <label className="block">
              <span className="block text-xs font-semibold uppercase tracking-wider text-mutedink">What are you sourcing?</span>
              <textarea
                rows={5}
                name="sourcing"
                defaultValue={prefill}
                placeholder="Describe products, specs, drawings..."
                className="mt-1 w-full rounded-md border border-input bg-offwhite px-3 py-2.5 text-sm outline-none focus:border-ocean"
              />
            </label>
          </div>

          <div className="mt-5 grid gap-5 sm:grid-cols-2">
            <label className="block">
              <span className="block text-xs font-semibold uppercase tracking-wider text-mutedink">Quantity / Volume</span>
              <input name="qty" placeholder="e.g. 500 sqm or 2 × 40ft" className="mt-1 w-full rounded-md border border-input bg-offwhite px-3 py-2.5 font-mono-data text-sm outline-none focus:border-ocean" />
            </label>
            <SelectField label="Timeline" name="timeline" options={["Urgent – within 4 weeks", "1–3 months", "3–6 months", "Planning stage"]} />
          </div>

          <div className="mt-5">
            <span className="block text-xs font-semibold uppercase tracking-wider text-mutedink">Upload BOQ, drawings, spec sheets</span>
            <label className="mt-1 flex cursor-pointer items-center justify-center rounded-lg border-2 border-dashed border-ocean/40 bg-offwhite px-4 py-8 text-center hover:border-ocean">
              <input type="file" className="hidden" multiple />
              <div>
                <div className="text-sm font-semibold text-navy">Drop files or click to upload</div>
                <div className="mt-1 font-mono-data text-xs text-mutedink">Max 10MB · PDF, XLS, DWG, JPG accepted</div>
              </div>
            </label>
          </div>

          <div className="mt-5">
            <SelectField label="How did you hear about us?" name="source" options={["Google search", "LinkedIn", "Referral", "Trade event", "Other"]} />
          </div>

          {error && (
            <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
          )}

          <button type="submit" disabled={submitting} className="mt-8 w-full rounded-md bg-navy py-3.5 text-sm font-semibold text-white hover:bg-[#1A5491] disabled:cursor-not-allowed disabled:opacity-60">
            {submitting ? "Submitting…" : "Send Enquiry →"}
          </button>
        </form>
      </div>
    </div>
  );
}

function Field({ label, name, type = "text", required, placeholder }: { label: string; name: string; type?: string; required?: boolean; placeholder?: string }) {
  return (
    <label className="block">
      <span className="block text-xs font-semibold uppercase tracking-wider text-mutedink">{label}{required && " *"}</span>
      <input type={type} name={name} required={required} placeholder={placeholder} className="mt-1 w-full rounded-md border border-input bg-offwhite px-3 py-2.5 text-sm outline-none focus:border-ocean" />
    </label>
  );
}

function SelectField({ label, name, options }: { label: string; name: string; options: string[] }) {
  return (
    <label className="block">
      <span className="block text-xs font-semibold uppercase tracking-wider text-mutedink">{label}</span>
      <select name={name} className="mt-1 w-full rounded-md border border-input bg-offwhite px-3 py-2.5 text-sm outline-none focus:border-ocean">
        {options.map((o) => <option key={o}>{o}</option>)}
      </select>
    </label>
  );
}
