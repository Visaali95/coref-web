import { createFileRoute, Link } from "@tanstack/react-router";
import { useRef, useState, useMemo, useCallback } from "react";
import {
  CheckCircle2,
  X,
  AlertCircle,
  CheckCircle,
  FileText,
  FileImage,
  FileSpreadsheet,
  FileCode,
  Paperclip,
  UploadCloud,
  Loader2,
} from "lucide-react";
import { useEnquiry } from "@/lib/enquiry";
import { apiFetch, apiUrl } from "@/lib/api";

export const Route = createFileRoute("/enquiry")({
  head: () => ({
    meta: [
      { title: "Start an Enquiry — Coref" },
      { name: "description", content: "Submit a sourcing request. Coref reviews within 2 hours and returns a supplier shortlist within 24." },
    ],
  }),
  component: EnquiryPage,
});

// ═══════════════════════════════════════════════════════════════════════════════
// FILE ATTACHMENT TYPES & HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

export type AttachedFile = {
  id: string;
  name: string;
  size: number;
  url?: string;
  uploading: boolean;
  error?: string;
};

const ALLOWED_EXTENSIONS = [
  ".pdf", ".jpg", ".jpeg", ".png", ".webp", ".gif", ".svg",
  ".xls", ".xlsx", ".csv", ".doc", ".docx", ".dwg", ".dxf", ".zip", ".txt"
];

function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function getFileIcon(filename: string) {
  const ext = filename.split(".").pop()?.toLowerCase();
  if (["jpg", "jpeg", "png", "webp", "gif", "svg"].includes(ext || "")) return FileImage;
  if (["xls", "xlsx", "csv"].includes(ext || "")) return FileSpreadsheet;
  if (["pdf"].includes(ext || "")) return FileText;
  if (["dwg", "dxf"].includes(ext || "")) return FileCode;
  return Paperclip;
}

// ═══════════════════════════════════════════════════════════════════════════════
// VALIDATION ENGINE
// ═══════════════════════════════════════════════════════════════════════════════

function hasExcessiveRepeats(s: string): boolean {
  const clean = s.replace(/\s/g, "").toLowerCase();
  if (clean.length < 2) return false;
  for (const ch of new Set(clean)) {
    if ((clean.match(new RegExp(ch.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"))?.length ?? 0) / clean.length > 0.6)
      return true;
  }
  return false;
}

const KEYBOARD_JUNK = [
  "qwerty","qwert","qwer","asdf","asdfg","asdfgh","zxcvb","zxcv",
  "abcde","abcd","abcdefg","zyxwv","aaaaaa","bbbbbb",
  "123456","234567","345678","456789","1234567","12345678",
  "987654","876543","765432","9876543","987654321",
];
function isKeyboardJunk(s: string): boolean {
  const lower = s.toLowerCase().replace(/[\s\-'.]/g, "");
  return KEYBOARD_JUNK.some((p) => lower.includes(p));
}

function isAllSame(s: string): boolean {
  return s.length > 1 && new Set(s.split("")).size === 1;
}

function isSequentialDigits(s: string): boolean {
  const asc  = "01234567890123456789";
  const desc = "98765432109876543210";
  return asc.includes(s) || desc.includes(s);
}

function isRepeatedPattern(s: string): boolean {
  for (let len = 1; len <= Math.floor(s.length / 2); len++) {
    const unit = s.slice(0, len);
    if (unit.repeat(Math.ceil(s.length / len)).slice(0, s.length) === s) return true;
  }
  return false;
}

const NAME_BLOCKLIST = new Set([
  "test","testing","hello","hi","hey","bye","foo","bar","baz","qux",
  "xxx","yyy","zzz","null","none","na","n/a","sample","example",
  "admin","dummy","fake","user","person","unknown","anonymous",
  "firstname","lastname","fullname","yourname","name","enter","type",
  "first","last","mr","mrs","sir","madam","nobody","someone","anyone",
  "random","placeholder","noreply","demo","temp",
]);

const COMPANY_BLOCKLIST = new Set([
  "test","testing","hello","hi","hey","company","mycompany","yourcompany",
  "acme","foo","bar","baz","null","none","na","n/a","sample","example",
  "admin","dummy","fake","unknown","anonymous","company name","firm",
  "business","companyname","enter","type","placeholder","demo","temp",
  "xyz","abc","abcd","ltd","pvt","inc","llc",
]);

function validateName(v: string, label = "Name"): string | null {
  const s = v.trim();
  if (!s) return "This field is required.";
  if (s.length < 2) return `${label} must be at least 2 characters.`;
  if (s.length > 50) return `${label} must be 50 characters or fewer.`;
  if (/\d/.test(s)) return `${label} should not contain numbers.`;
  if (!/^[\p{L}\p{M}'\-\s.]+$/u.test(s))
    return `${label} should contain only letters, spaces, hyphens, or apostrophes.`;
  if (isAllSame(s.toLowerCase().replace(/\s/g, "")))
    return `${label} appears to be invalid (repeated characters).`;
  if (hasExcessiveRepeats(s))
    return `${label} appears to be invalid (too many repeated characters).`;
  if (isKeyboardJunk(s))
    return `${label} appears to be a test or invalid value.`;
  if (NAME_BLOCKLIST.has(s.toLowerCase().replace(/\s/g, "")))
    return `Please enter your real ${label.toLowerCase()}.`;
  if ((s.match(/[\p{L}]/gu) ?? []).length < 2)
    return `${label} must contain at least 2 letters.`;
  return null;
}

function validateCompany(v: string): string | null {
  const s = v.trim();
  if (!s) return "Company name is required.";
  if (s.length < 3) return "Company name must be at least 3 characters.";
  if (s.length > 100) return "Company name must be 100 characters or fewer.";
  if ((s.match(/[\p{L}]/gu) ?? []).length < 2)
    return "Company name must contain at least 2 letters.";
  if (!/^[\p{L}\p{M}0-9\s&.,\-'()/+@]+$/u.test(s))
    return "Company name contains unsupported characters.";
  if (isAllSame(s.toLowerCase().replace(/[\s&.,\-'()/+@]/g, "")))
    return "Company name appears to be invalid (repeated characters).";
  if (hasExcessiveRepeats(s))
    return "Company name appears to be invalid (too many repeated characters).";
  if (isKeyboardJunk(s))
    return "Please enter your real company name.";
  if (COMPANY_BLOCKLIST.has(s.toLowerCase().replace(/[\s.,\-'()/+@]/g, "")))
    return "Please enter your real company name.";
  return null;
}

function validateEmail(v: string): string | null {
  const s = v.trim();
  if (!s) return "Email address is required.";
  if (s.length > 254) return "Email address is too long.";
  if (!s.includes("@")) return "Please enter a valid email address. '@' is required.";

  const [localPart, ...domainParts] = s.split("@");
  const domain = domainParts.join("@");

  if (!localPart) return "Please enter the part before '@'.";
  if (!domain) return "Please enter a domain after '@' (e.g. gmail.com).";
  if (domainParts.length > 1) return "Email address must contain only one '@'.";
  if (localPart.startsWith(".") || localPart.endsWith("."))
    return "The part before '@' cannot start or end with a dot.";
  if (localPart.includes(".."))
    return "The part before '@' cannot contain consecutive dots.";
  if (!domain.includes("."))
    return "Domain must include a dot (e.g. gmail.com, not just 'gmail').";

  const domainParts2 = domain.split(".");
  const tld = domainParts2[domainParts2.length - 1];
  if (tld.length < 2) return "Domain extension must be at least 2 characters (e.g. .com, .in).";
  if (domain.endsWith(".")) return "Domain cannot end with a dot.";
  if (domain.startsWith(".")) return "Domain cannot start with a dot.";

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s))
    return "Please enter a valid email address (e.g. name@domain.com).";

  return null;
}

interface CountryCode {
  code: string;
  label: string;
  minDigits: number;
  maxDigits: number;
  startPattern?: RegExp;
  description: string;
}

const COUNTRY_CODES: CountryCode[] = [
  { code: "+91",  label: "🇮🇳 +91 India",          minDigits: 10, maxDigits: 10, startPattern: /^[6-9]/,  description: "Indian mobile (10 digits starting with 6–9)" },
  { code: "+1",   label: "🇺🇸 +1 USA / Canada",     minDigits: 10, maxDigits: 10, startPattern: /^[2-9]/,  description: "US/CA number (10 digits, area code 2–9)" },
  { code: "+44",  label: "🇬🇧 +44 UK",              minDigits: 10, maxDigits: 11, startPattern: /^[0-9]/,  description: "UK number (10–11 digits)" },
  { code: "+61",  label: "🇦🇺 +61 Australia",       minDigits: 9,  maxDigits: 9,  description: "AU number (9 digits)" },
  { code: "+971", label: "🇦🇪 +971 UAE",            minDigits: 9,  maxDigits: 9,  startPattern: /^[5]/,    description: "UAE mobile (9 digits starting with 5)" },
  { code: "+65",  label: "🇸🇬 +65 Singapore",       minDigits: 8,  maxDigits: 8,  startPattern: /^[689]/,  description: "SG number (8 digits starting with 6, 8, or 9)" },
  { code: "+86",  label: "🇨🇳 +86 China",           minDigits: 11, maxDigits: 11, startPattern: /^1/,      description: "CN mobile (11 digits starting with 1)" },
  { code: "+49",  label: "🇩🇪 +49 Germany",         minDigits: 10, maxDigits: 12, description: "DE number (10–12 digits)" },
  { code: "+33",  label: "🇫🇷 +33 France",          minDigits: 9,  maxDigits: 9,  description: "FR number (9 digits)" },
  { code: "+81",  label: "🇯🇵 +81 Japan",           minDigits: 10, maxDigits: 11, description: "JP number (10–11 digits)" },
  { code: "+55",  label: "🇧🇷 +55 Brazil",          minDigits: 10, maxDigits: 11, description: "BR number (10–11 digits)" },
  { code: "+7",   label: "🇷🇺 +7 Russia",           minDigits: 10, maxDigits: 10, startPattern: /^[79]/,   description: "RU number (10 digits starting with 7 or 9)" },
  { code: "+39",  label: "🇮🇹 +39 Italy",           minDigits: 6,  maxDigits: 11, description: "IT number (6–11 digits)" },
  { code: "+34",  label: "🇪🇸 +34 Spain",           minDigits: 9,  maxDigits: 9,  description: "ES number (9 digits)" },
  { code: "+82",  label: "🇰🇷 +82 South Korea",     minDigits: 9,  maxDigits: 10, description: "KR number (9–10 digits)" },
  { code: "+90",  label: "🇹🇷 +90 Turkey",          minDigits: 10, maxDigits: 10, startPattern: /^[5]/,    description: "TR mobile (10 digits starting with 5)" },
  { code: "+966", label: "🇸🇦 +966 Saudi Arabia",   minDigits: 9,  maxDigits: 9,  startPattern: /^[5]/,    description: "SA mobile (9 digits starting with 5)" },
  { code: "+31",  label: "🇳🇱 +31 Netherlands",     minDigits: 9,  maxDigits: 9,  description: "NL number (9 digits)" },
  { code: "+46",  label: "🇸🇪 +46 Sweden",          minDigits: 7,  maxDigits: 9,  description: "SE number (7–9 digits)" },
  { code: "+41",  label: "🇨🇭 +41 Switzerland",     minDigits: 9,  maxDigits: 9,  description: "CH number (9 digits)" },
  { code: "+27",  label: "🇿🇦 +27 South Africa",    minDigits: 9,  maxDigits: 9,  description: "ZA number (9 digits)" },
  { code: "+60",  label: "🇲🇾 +60 Malaysia",        minDigits: 9,  maxDigits: 10, description: "MY number (9–10 digits)" },
  { code: "+62",  label: "🇮🇩 +62 Indonesia",       minDigits: 9,  maxDigits: 12, description: "ID number (9–12 digits)" },
  { code: "+63",  label: "🇵🇭 +63 Philippines",     minDigits: 10, maxDigits: 10, description: "PH number (10 digits)" },
  { code: "+64",  label: "🇳🇿 +64 New Zealand",     minDigits: 8,  maxDigits: 10, description: "NZ number (8–10 digits)" },
  { code: "+92",  label: "🇵🇰 +92 Pakistan",        minDigits: 10, maxDigits: 10, startPattern: /^[3]/,    description: "PK mobile (10 digits starting with 3)" },
  { code: "+880", label: "🇧🇩 +880 Bangladesh",     minDigits: 10, maxDigits: 10, description: "BD number (10 digits)" },
  { code: "+94",  label: "🇱🇰 +94 Sri Lanka",       minDigits: 9,  maxDigits: 9,  description: "LK number (9 digits)" },
];

const UNIQUE_COUNTRY_CODES = COUNTRY_CODES.filter((c, i) =>
  COUNTRY_CODES.findIndex((x) => x.code === c.code) === i
);

function validatePhone(digits: string, countryCode: string): string | null {
  if (!digits.trim()) return null;
  const clean = digits.replace(/[\s\-().]/g, "");

  if (!/^\d+$/.test(clean))
    return "Phone number must contain digits only (spaces and dashes are allowed).";

  if (isAllSame(clean))
    return `Invalid phone number — all digits are the same.`;
  if (isSequentialDigits(clean))
    return "Invalid phone number — sequential digit pattern is not allowed.";
  if (isRepeatedPattern(clean) && clean.length >= 6)
    return "Invalid phone number — repeated pattern detected.";

  const rule = UNIQUE_COUNTRY_CODES.find((c) => c.code === countryCode);
  if (rule) {
    if (clean.length < rule.minDigits)
      return `Too short for ${rule.code}. Expected ${rule.minDigits === rule.maxDigits ? rule.minDigits : `${rule.minDigits}–${rule.maxDigits}`} digits.`;
    if (clean.length > rule.maxDigits)
      return `Too long for ${rule.code}. Expected ${rule.minDigits === rule.maxDigits ? rule.minDigits : `${rule.minDigits}–${rule.maxDigits}`} digits.`;
    if (rule.startPattern && !rule.startPattern.test(clean))
      return `${rule.code} numbers must start with ${rule.startPattern.toString().slice(2, -1)}. (${rule.description})`;
  }

  return null;
}

function validateSourcing(v: string): string | null {
  const s = v.trim();
  if (!s) return "Please describe what you are sourcing.";
  if (s.length < 10) return "Please provide more detail (at least 10 characters).";
  if (s.length > 2000) return "Description is too long (max 2000 characters).";
  if (isAllSame(s.replace(/\s/g, ""))) return "Please enter a meaningful description.";
  if (hasExcessiveRepeats(s)) return "Please enter a meaningful description.";
  if (isKeyboardJunk(s)) return "Please enter a meaningful description of what you need.";
  const wordCount = s.split(/\s+/).filter((w) => w.length > 1).length;
  if (wordCount < 2) return "Please use at least 2 words to describe your sourcing requirement.";
  return null;
}

function validateQuantity(v: string): string | null {
  if (!v.trim()) return null;
  const s = v.trim();
  if (s.length > 100) return "Quantity is too long (max 100 characters).";
  if (!/\d/.test(s)) return "Please include a number (e.g. 500 sqm, 2 × 40ft).";
  if (!/^[\d\s.,×xX/\-+()a-zA-Z%]+$/.test(s))
    return "Quantity contains unsupported characters.";
  return null;
}

// ═══════════════════════════════════════════════════════════════════════════════
// REUSABLE UI COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════════

function ErrorMsg({ id, msg }: { id: string; msg: string }) {
  return (
    <span
      id={id}
      role="alert"
      className="flex items-center gap-1 text-xs font-medium text-red-600"
      style={{ animation: "errIn 0.14s ease" }}
    >
      <AlertCircle className="h-3 w-3 shrink-0" />
      {msg}
    </span>
  );
}

function SuccessIcon() {
  return <CheckCircle className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-green/70 pointer-events-none" />;
}

function fieldBorder(touched: boolean, error: string | null, value: string): string {
  if (touched && error) return "border-red-400 focus:border-red-500 bg-red-50/30";
  if (value.trim() && !error) return "border-green/60 focus:border-green";
  return "border-input focus:border-ocean";
}

interface FProps {
  label: string; name: string; required?: boolean; type?: string;
  placeholder?: string; value: string; error: string | null;
  onChange: (v: string) => void; onBlur: () => void; touched: boolean;
  maxLength?: number; hint?: string;
}

function ValidatedField({ label, name, required, type = "text", placeholder, value, error, onChange, onBlur, touched, maxLength, hint }: FProps) {
  const hasError = touched && !!error;
  const isOk = !!value.trim() && !error;
  return (
    <div className="flex flex-col gap-1">
      <span className="block text-xs font-semibold uppercase tracking-wider text-mutedink">
        {label}{required && <span className="ml-0.5 text-red-500">*</span>}
      </span>
      <div className="relative">
        <input
          id={`f-${name}`}
          type={type}
          name={name}
          placeholder={placeholder}
          value={value}
          maxLength={maxLength}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          autoComplete="off"
          aria-invalid={hasError}
          aria-describedby={hasError ? `err-${name}` : undefined}
          className={`w-full rounded-md border px-3 py-2.5 pr-8 text-sm outline-none transition-colors bg-offwhite focus:bg-white ${fieldBorder(touched, error, value)}`}
        />
        {isOk && <SuccessIcon />}
      </div>
      {hint && !hasError && <span className="text-[11px] text-mutedink">{hint}</span>}
      {hasError && <ErrorMsg id={`err-${name}`} msg={error!} />}
    </div>
  );
}

interface PhoneFieldProps {
  countryCode: string; phoneNumber: string;
  phoneError: string | null; phoneTouched: boolean;
  onCodeChange: (v: string) => void;
  onNumberChange: (v: string) => void;
  onBlur: () => void;
}

function PhoneField({ countryCode, phoneNumber, phoneError, phoneTouched, onCodeChange, onNumberChange, onBlur }: PhoneFieldProps) {
  const hasError = phoneTouched && !!phoneError;
  const isOk = !!phoneNumber.trim() && !phoneError;
  return (
    <div className="flex flex-col gap-1">
      <span className="block text-xs font-semibold uppercase tracking-wider text-mutedink">
        WhatsApp / Phone
        <span className="ml-1 font-normal normal-case text-[10px] text-mutedink">(optional)</span>
      </span>
      <div className="flex gap-2">
        <select
          value={countryCode}
          onChange={(e) => onCodeChange(e.target.value)}
          className="shrink-0 rounded-md border border-input bg-offwhite px-2 py-2.5 text-sm outline-none focus:border-ocean w-[130px]"
        >
          {UNIQUE_COUNTRY_CODES.map((c) => (
            <option key={c.code} value={c.code}>{c.label}</option>
          ))}
        </select>

        <div className="relative flex-1">
          <input
            id="f-phone"
            type="tel"
            name="whatsapp"
            placeholder="98200 12000"
            value={phoneNumber}
            maxLength={15}
            onChange={(e) => onNumberChange(e.target.value.replace(/[^\d\s\-().]/g, ""))}
            onBlur={onBlur}
            aria-invalid={hasError}
            aria-describedby={hasError ? "err-phone" : undefined}
            className={`w-full rounded-md border px-3 py-2.5 pr-8 font-mono-data text-sm outline-none transition-colors bg-offwhite focus:bg-white ${
              hasError ? "border-red-400 focus:border-red-500 bg-red-50/30" : isOk ? "border-green/60 focus:border-green" : "border-input focus:border-ocean"
            }`}
          />
          {isOk && <SuccessIcon />}
        </div>
      </div>
      {hasError && <ErrorMsg id="err-phone" msg={phoneError!} />}
    </div>
  );
}

function ValidatedTextarea({ label, name, placeholder, rows = 5, value, error, onChange, onBlur, touched, maxLength = 2000 }: {
  label: string; name: string; placeholder?: string; rows?: number;
  value: string; error: string | null; onChange: (v: string) => void;
  onBlur: () => void; touched: boolean; maxLength?: number;
}) {
  const hasError = touched && !!error;
  const remaining = maxLength - value.length;
  return (
    <div className="flex flex-col gap-1">
      <span className="block text-xs font-semibold uppercase tracking-wider text-mutedink">{label}</span>
      <textarea
        id={`f-${name}`}
        rows={rows}
        name={name}
        placeholder={placeholder}
        value={value}
        maxLength={maxLength}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        aria-invalid={hasError}
        aria-describedby={hasError ? `err-${name}` : undefined}
        className={`rounded-md border px-3 py-2.5 text-sm outline-none transition-colors bg-offwhite focus:bg-white ${fieldBorder(touched, error, value)}`}
      />
      <div className="flex items-center justify-between">
        {hasError ? <ErrorMsg id={`err-${name}`} msg={error!} /> : <span />}
        <span className={`text-[11px] ${remaining < 100 ? "text-amber-600" : "text-mutedink"}`}>
          {remaining} chars left
        </span>
      </div>
    </div>
  );
}

function QuantityField({ value, error, onChange, onBlur, touched }: {
  value: string; error: string | null; onChange: (v: string) => void;
  onBlur: () => void; touched: boolean;
}) {
  const hasError = touched && !!error;
  const isOk = !!value.trim() && !error;
  return (
    <div className="flex flex-col gap-1">
      <span className="block text-xs font-semibold uppercase tracking-wider text-mutedink">
        Quantity / Volume
        <span className="ml-1 font-normal normal-case text-[10px] text-mutedink">(optional)</span>
      </span>
      <div className="relative">
        <input
          name="qty"
          placeholder="e.g. 500 sqm or 2 × 40ft"
          value={value}
          maxLength={100}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          className={`w-full rounded-md border px-3 py-2.5 pr-8 font-mono-data text-sm outline-none transition-colors bg-offwhite focus:bg-white ${fieldBorder(touched, error, value)}`}
        />
        {isOk && <SuccessIcon />}
      </div>
      {hasError && <ErrorMsg id="err-qty" msg={error!} />}
    </div>
  );
}

function SelectField({ label, name, options }: { label: string; name: string; options: string[] }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="block text-xs font-semibold uppercase tracking-wider text-mutedink">{label}</span>
      <select name={name} className="rounded-md border border-input bg-offwhite px-3 py-2.5 text-sm outline-none focus:border-ocean">
        {options.map((o) => <option key={o}>{o}</option>)}
      </select>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// FILE UPLOADER COMPONENT (PDF, IMAGES, DWG, EXCEL, WORD, ZIP, ETC.)
// ═══════════════════════════════════════════════════════════════════════════════

function FileUploader({
  files,
  onFilesChange,
}: {
  files: AttachedFile[];
  onFilesChange: (files: AttachedFile[]) => void;
}) {
  const [dragActive, setDragActive] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const processFiles = async (fileList: FileList | File[]) => {
    setUploadError(null);
    const newFiles: AttachedFile[] = [...files];

    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      const ext = `.${file.name.split(".").pop()?.toLowerCase()}`;

      if (newFiles.length >= 10) {
        setUploadError("Maximum 10 files allowed per enquiry.");
        break;
      }

      if (!ALLOWED_EXTENSIONS.includes(ext)) {
        setUploadError(`File '${file.name}' is not allowed. Please upload PDF, Image, Excel, Word, DWG, or ZIP files.`);
        continue;
      }

      if (file.size > 10 * 1024 * 1024) {
        setUploadError(`File '${file.name}' exceeds the 10 MB size limit.`);
        continue;
      }

      const tempId = `${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      const fileEntry: AttachedFile = {
        id: tempId,
        name: file.name,
        size: file.size,
        uploading: true,
      };

      newFiles.push(fileEntry);
      onFilesChange([...newFiles]);

      // Instant background upload
      const formData = new FormData();
      formData.append("file", file);

      try {
        const response = await fetch(apiUrl("/api/upload/document"), {
          method: "POST",
          body: formData,
        });

        if (!response.ok) {
          const errRes = await response.json().catch(() => ({}));
          throw new Error(errRes.message || "Failed to upload file");
        }

        const data = await response.json();
        const index = newFiles.findIndex((f) => f.id === tempId);
        if (index !== -1) {
          newFiles[index] = {
            ...newFiles[index],
            url: data.url,
            uploading: false,
          };
          onFilesChange([...newFiles]);
        }
      } catch (err) {
        const index = newFiles.findIndex((f) => f.id === tempId);
        if (index !== -1) {
          newFiles[index] = {
            ...newFiles[index],
            uploading: false,
            error: (err as Error).message || "Upload failed",
          };
          onFilesChange([...newFiles]);
        }
      }
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFiles(e.dataTransfer.files);
    }
  };

  const handleRemove = (id: string) => {
    onFilesChange(files.filter((f) => f.id !== id));
  };

  return (
    <div className="flex flex-col gap-2">
      <span className="block text-xs font-semibold uppercase tracking-wider text-mutedink">
        Upload BOQ, drawings, spec sheets
        <span className="ml-1 font-normal normal-case text-[10px] text-mutedink">(optional)</span>
      </span>

      {/* Dropzone area */}
      <div
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={`relative flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed px-4 py-7 text-center transition-all ${
          dragActive
            ? "border-ocean bg-ocean/10 scale-[0.99]"
            : "border-ocean/40 bg-offwhite hover:border-ocean hover:bg-slate-50"
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          multiple
          accept={ALLOWED_EXTENSIONS.join(",")}
          onChange={(e) => {
            if (e.target.files) processFiles(e.target.files);
            e.target.value = "";
          }}
        />
        <div className="mx-auto grid h-10 w-10 place-items-center rounded-full bg-navy/10 text-navy mb-2">
          <UploadCloud className="h-5 w-5" />
        </div>
        <div className="text-sm font-semibold text-navy">
          Drop files here or <span className="text-ocean underline">browse</span>
        </div>
        <div className="mt-1 font-mono-data text-xs text-mutedink">
          Max 10 MB per file · PDF, Images (JPG, PNG, WEBP), Excel, Word, DWG, ZIP accepted
        </div>
      </div>

      {/* Real-time file validation error */}
      {uploadError && (
        <div className="flex items-center gap-1.5 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{uploadError}</span>
        </div>
      )}

      {/* Uploaded File Item List */}
      {files.length > 0 && (
        <div className="mt-2 space-y-2">
          <div className="text-xs font-semibold uppercase tracking-wider text-mutedink">
            Attached Files ({files.length})
          </div>
          <div className="space-y-1.5">
            {files.map((file) => {
              const IconComp = getFileIcon(file.name);
              return (
                <div
                  key={file.id}
                  className={`flex items-center justify-between gap-3 rounded-lg border p-2.5 text-xs transition-colors ${
                    file.error
                      ? "border-red-200 bg-red-50/50"
                      : file.uploading
                      ? "border-amber-200 bg-amber-50/30"
                      : "border-border bg-white"
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <div className="grid h-7 w-7 shrink-0 place-items-center rounded bg-secondary text-navy">
                      <IconComp className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-navy truncate" title={file.name}>
                        {file.name}
                      </div>
                      <div className="font-mono-data text-[10px] text-mutedink flex items-center gap-2">
                        <span>{formatFileSize(file.size)}</span>
                        {file.uploading && (
                          <span className="inline-flex items-center gap-1 text-amber-600">
                            <Loader2 className="h-3 w-3 animate-spin" /> Uploading…
                          </span>
                        )}
                        {!file.uploading && file.url && (
                          <span className="inline-flex items-center gap-1 text-green font-semibold">
                            <CheckCircle className="h-3 w-3" /> Ready
                          </span>
                        )}
                        {!file.uploading && file.error && (
                          <span className="text-red-600 font-semibold">{file.error}</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemove(file.id);
                    }}
                    className="h-6 w-6 grid place-items-center rounded-full text-mutedink hover:bg-slate-100 hover:text-navy transition-colors shrink-0"
                    title="Remove file"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════════════════════

type FieldName = "firstName" | "lastName" | "company" | "email" | "phone" | "sourcing" | "qty";

const EMPTY_VALUES: Record<FieldName, string> = {
  firstName: "", lastName: "", company: "", email: "", phone: "", sourcing: "", qty: "",
};
const EMPTY_TOUCHED: Record<FieldName, boolean> = {
  firstName: false, lastName: false, company: false, email: false, phone: false, sourcing: false, qty: false,
};

function EnquiryPage() {
  const { items, remove } = useEnquiry();
  const [submitted, setSubmitted]   = useState(false);
  const [reference, setReference]   = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const prefill = useMemo(
    () => items.length ? items.map((i) => `- ${i.name} (${i.spec ?? ""}) · ${i.origin ?? ""}`).join("\n") : "",
    [items],
  );

  const [values, setValues]   = useState<Record<FieldName, string>>({ ...EMPTY_VALUES, sourcing: prefill });
  const [touched, setTouched] = useState<Record<FieldName, boolean>>({ ...EMPTY_TOUCHED });
  const [countryCode, setCountryCode] = useState("+91");
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);

  const errors = useMemo<Record<FieldName, string | null>>(() => ({
    firstName: validateName(values.firstName, "First name"),
    lastName:  validateName(values.lastName,  "Last name"),
    company:   validateCompany(values.company),
    email:     validateEmail(values.email),
    phone:     validatePhone(values.phone, countryCode),
    sourcing:  validateSourcing(values.sourcing),
    qty:       validateQuantity(values.qty),
  }), [values, countryCode]);

  const isFormValid = Object.values(errors).every((e) => e === null);

  const set = useCallback((f: FieldName) => (v: string) => setValues((p) => ({ ...p, [f]: v })), []);
  const blur = useCallback((f: FieldName) => () => setTouched((p) => ({ ...p, [f]: true })), []);
  const touchAll = () => setTouched({ firstName: true, lastName: true, company: true, email: true, phone: true, sourcing: true, qty: true });

  const invalidCount = Object.entries(errors).filter(([, e]) => e !== null).length;

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    touchAll();
    if (!isFormValid) return;

    // Wait if any files are currently uploading
    if (attachedFiles.some((f) => f.uploading)) {
      setSubmitError("Please wait for all files to finish uploading before submitting.");
      return;
    }

    setSubmitError(null);
    setSubmitting(true);
    const fd = new FormData(e.currentTarget);

    const fullPhone = values.phone.trim() ? `${countryCode} ${values.phone.trim()}` : "";

    const readyAttachments = attachedFiles
      .filter((f) => f.url && !f.error)
      .map((f) => ({ name: f.name, url: f.url!, size: f.size }));

    const payload = {
      name:    `${values.firstName.trim()} ${values.lastName.trim()}`,
      company: values.company.trim(),
      role:    fd.get("role") as string,
      email:   values.email.trim(),
      phone:   fullPhone,
      items: items.length
        ? items.map((i) => i.name).join(", ")
        : (values.sourcing || "General enquiry"),
      message: [
        values.sourcing,
        values.qty       ? `Quantity: ${values.qty}`          : "",
        fd.get("timeline")    ? `Timeline: ${fd.get("timeline")}`       : "",
        fd.get("destination") ? `Destination: ${fd.get("destination")}` : "",
        fd.get("source")      ? `Source: ${fd.get("source")}`           : "",
      ].filter(Boolean).join("\n"),
      attachments: readyAttachments.length ? JSON.stringify(readyAttachments) : null,
    };

    try {
      const result = await apiFetch<{ reference: string }>("/api/enquiries", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      setReference(result.reference);
      setSubmitted(true);
    } catch (err) {
      setSubmitError((err as Error).message || "Failed to submit enquiry. Please try again.");
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
          <button
            onClick={() => {
              setSubmitted(false); setReference("");
              setValues({ ...EMPTY_VALUES });
              setTouched({ ...EMPTY_TOUCHED });
              setCountryCode("+91");
              setAttachedFiles([]);
              formRef.current?.reset();
            }}
            className="rounded-md border border-navy px-5 py-2.5 text-sm font-semibold text-navy hover:bg-navy hover:text-white"
          >
            Submit Another Enquiry
          </button>
          <Link to="/products/$category" params={{ category: "tiles-flooring" }} className="rounded-md bg-navy px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#1A5491]">
            Browse More Products
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <style>{`
        @keyframes errIn { from { opacity: 0; transform: translateY(-3px) } to { opacity: 1; transform: translateY(0) } }
      `}</style>

      <div className="grid overflow-hidden rounded-2xl border border-border shadow-sm lg:grid-cols-[2fr_3fr]">

        {/* Left panel */}
        <aside className="bg-navy p-8 text-white sm:p-10">
          <h1 className="font-display text-3xl font-extrabold">Start your sourcing journey</h1>
          <p className="mt-3 text-sm text-white/70">Tell us what you're sourcing and where it needs to land. We'll handle the rest.</p>

          <div className="mt-8 space-y-3">
            <div className="text-xs font-semibold uppercase tracking-wider text-ocean">What happens next</div>
            {["Coref reviews your requirement within 2 hours", "Supplier shortlist within 24 hours", "Samples dispatched within 7 days if requested"].map((s) => (
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
        <form ref={formRef} className="bg-white p-8 sm:p-10" onSubmit={handleSubmit} noValidate>

          {/* Row 1: First Name + Last Name */}
          <div className="grid gap-5 sm:grid-cols-2">
            <ValidatedField
              label="First Name" name="firstName" required
              value={values.firstName} error={errors.firstName}
              onChange={set("firstName")} onBlur={blur("firstName")} touched={touched.firstName}
              maxLength={50} placeholder="e.g. Rahul"
            />
            <ValidatedField
              label="Last Name" name="lastName" required
              value={values.lastName} error={errors.lastName}
              onChange={set("lastName")} onBlur={blur("lastName")} touched={touched.lastName}
              maxLength={50} placeholder="e.g. Sharma"
            />
          </div>

          {/* Row 2: Company + Role */}
          <div className="mt-5 grid gap-5 sm:grid-cols-2">
            <ValidatedField
              label="Company Name" name="company" required
              value={values.company} error={errors.company}
              onChange={set("company")} onBlur={blur("company")} touched={touched.company}
              maxLength={100} placeholder="e.g. Sharma Constructions Pvt Ltd"
            />
            <SelectField
              label="Your Role" name="role"
              options={["Architect", "Interior Designer", "Builder", "Developer", "Machinery Buyer", "Business Owner", "Other"]}
            />
          </div>

          {/* Row 3: Email + Phone */}
          <div className="mt-5 grid gap-5 sm:grid-cols-2">
            <ValidatedField
              label="Email" name="email" type="email" required
              value={values.email} error={errors.email}
              onChange={set("email")} onBlur={blur("email")} touched={touched.email}
              placeholder="name@company.com"
            />
            <PhoneField
              countryCode={countryCode} phoneNumber={values.phone}
              phoneError={errors.phone} phoneTouched={touched.phone}
              onCodeChange={setCountryCode}
              onNumberChange={set("phone")}
              onBlur={blur("phone")}
            />
          </div>

          {/* Row 4: Destination */}
          <div className="mt-5 grid gap-5 sm:grid-cols-2">
            <SelectField label="Destination" name="destination" options={["Mumbai", "Delhi", "Chennai", "Bangalore", "Hyderabad", "Pune", "Other"]} />
            <div />
          </div>

          {/* Sourcing description */}
          <div className="mt-5">
            <ValidatedTextarea
              label="What are you sourcing? *"
              name="sourcing"
              placeholder="Describe products, specs, grades, finish, dimensions, quantity..."
              rows={5}
              value={values.sourcing}
              error={errors.sourcing}
              onChange={set("sourcing")}
              onBlur={blur("sourcing")}
              touched={touched.sourcing}
            />
          </div>

          {/* Quantity + Timeline */}
          <div className="mt-5 grid gap-5 sm:grid-cols-2">
            <QuantityField
              value={values.qty} error={errors.qty}
              onChange={set("qty")} onBlur={blur("qty")} touched={touched.qty}
            />
            <SelectField label="Timeline" name="timeline" options={["Urgent – within 4 weeks", "1–3 months", "3–6 months", "Planning stage"]} />
          </div>

          {/* Interactive File Uploader */}
          <div className="mt-5">
            <FileUploader files={attachedFiles} onFilesChange={setAttachedFiles} />
          </div>

          {/* Source */}
          <div className="mt-5">
            <SelectField label="How did you hear about us?" name="source" options={["Google search", "LinkedIn", "Referral", "Trade event", "Other"]} />
          </div>

          {/* Server-side error */}
          {submitError && (
            <div className="mt-4 flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              {submitError}
            </div>
          )}

          {/* Form-level hint */}
          {!isFormValid && Object.values(touched).some(Boolean) && (
            <div className="mt-4 flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
              <AlertCircle className="h-4 w-4 shrink-0" />
              Please fix {invalidCount} field{invalidCount !== 1 ? "s" : ""} above before submitting.
            </div>
          )}

          {/* Submit button */}
          <button
            type="submit"
            disabled={submitting}
            onClick={touchAll}
            className={`mt-8 w-full rounded-md py-3.5 text-sm font-semibold transition-all ${
              !isFormValid && Object.values(touched).some(Boolean)
                ? "cursor-not-allowed bg-red-100 text-red-400"
                : "bg-navy text-white hover:bg-[#1A5491] disabled:cursor-not-allowed disabled:opacity-60"
            }`}
          >
            {submitting ? "Submitting…" : "Send Enquiry →"}
          </button>
        </form>
      </div>
    </div>
  );
}
