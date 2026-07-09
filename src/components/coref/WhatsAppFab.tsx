import { MessageCircle } from "lucide-react";

export function WhatsAppFab() {
  return (
    <a
      href="https://wa.me/919820012000"
      target="_blank"
      rel="noreferrer"
      className="group fixed bottom-6 right-6 z-50 grid h-14 w-14 place-items-center rounded-full bg-green text-white shadow-lg shadow-green/30 transition-transform hover:scale-105"
      aria-label="Chat on WhatsApp"
    >
      <MessageCircle className="h-6 w-6" />
      <span className="pointer-events-none absolute right-16 whitespace-nowrap rounded-md bg-navy px-3 py-1.5 text-xs font-medium text-white opacity-0 transition-opacity group-hover:opacity-100">
        Chat with Coref
      </span>
    </a>
  );
}
