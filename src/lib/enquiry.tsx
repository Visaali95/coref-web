import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type EnquiryItem = {
  id: string;
  name: string;
  spec?: string;
  origin?: string;
  image?: string;
};

type Ctx = {
  items: EnquiryItem[];
  add: (i: EnquiryItem) => void;
  remove: (id: string) => void;
  clear: () => void;
  has: (id: string) => boolean;
};

const EnquiryContext = createContext<Ctx | null>(null);

export function EnquiryProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<EnquiryItem[]>([]);

  useEffect(() => {
    try {
      const raw = typeof window !== "undefined" ? window.localStorage.getItem("coref-enquiry") : null;
      if (raw) setItems(JSON.parse(raw));
    } catch {}
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem("coref-enquiry", JSON.stringify(items));
    } catch {}
  }, [items]);

  const add = (i: EnquiryItem) =>
    setItems((prev) => (prev.find((p) => p.id === i.id) ? prev : [...prev, i]));
  const remove = (id: string) => setItems((prev) => prev.filter((p) => p.id !== id));
  const clear = () => setItems([]);
  const has = (id: string) => items.some((p) => p.id === id);

  return (
    <EnquiryContext.Provider value={{ items, add, remove, clear, has }}>
      {children}
    </EnquiryContext.Provider>
  );
}

export function useEnquiry() {
  const ctx = useContext(EnquiryContext);
  if (!ctx) throw new Error("useEnquiry must be used inside EnquiryProvider");
  return ctx;
}
