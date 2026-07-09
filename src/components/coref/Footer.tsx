import { Link } from "@tanstack/react-router";
import { CorefLogo } from "./Logo";

export function Footer() {
  return (
    <footer className="mt-24 bg-navy text-white">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-4">
        <div className="md:col-span-2">
          <CorefLogo inverted />
          <p className="mt-4 max-w-sm text-sm text-white/70">
            Coref gives architects, builders, and businesses direct access to vetted Chinese manufacturers — and owns logistics end-to-end, from factory floor to your site.
          </p>
        </div>
        <div>
          <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-ocean">Quick Links</div>
          <ul className="space-y-2 text-sm text-white/80">
            <li><Link to="/products/tiles-flooring" className="hover:text-white">Products</Link></li>
            <li><Link to="/how-it-works" className="hover:text-white">How it works</Link></li>
            <li><Link to="/enquiry" className="hover:text-white">Start an enquiry</Link></li>
            <li><Link to="/suppliers/$id" params={{ id: "guangdong-elite-ceramics" }} className="hover:text-white">Suppliers</Link></li>
          </ul>
        </div>
        <div>
          <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-ocean">Contact</div>
          <ul className="space-y-2 text-sm text-white/80">
            <li>hello@coref.in</li>
            <li>+91 22 4000 1200</li>
            <li>WhatsApp: +91 98200 12000</li>
          </ul>
        </div>
      </div>
      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-5 text-xs text-white/60 sm:px-6">
          <div>© 2026 Coref Logistics & Automation</div>
          <div className="flex items-center gap-4">
            <span>Mumbai · Delhi · Guangzhou</span>
            <Link to="/admin" className="text-white/40 hover:text-white/80">Admin</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
