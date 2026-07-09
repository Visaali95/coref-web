import { Link } from "@tanstack/react-router";
import { useEnquiry } from "@/lib/enquiry";

export function EnquiryStickyBar() {
  const { items } = useEnquiry();
  if (items.length === 0) return null;
  return (
    <div className="fixed bottom-0 left-0 right-0 z-30 border-t border-white/10 bg-navy text-white shadow-[0_-8px_24px_rgba(13,59,110,0.2)]">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <div className="text-sm">
          <span className="font-semibold">{items.length} product{items.length === 1 ? "" : "s"}</span>{" "}
          <span className="text-white/70">in your enquiry</span>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/enquiry" className="rounded-md border border-white/30 px-3 py-1.5 text-xs font-medium hover:bg-white/10">View List</Link>
          <Link to="/enquiry" className="rounded-md bg-ocean px-4 py-1.5 text-xs font-semibold text-navy hover:bg-white">Send Enquiry →</Link>
        </div>
      </div>
    </div>
  );
}
