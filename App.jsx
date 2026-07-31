import React, { useState, useEffect, useMemo } from "react";
import {
  LayoutDashboard, Users, Package, FileText, Plus, Search, X, Trash2, Edit2,
  Sun, Moon, Menu, Receipt, TrendingUp, AlertTriangle, IndianRupee, ChevronRight,
  BarChart3, Settings, Save, ArrowLeft, CheckCircle2, Clock,
  Download, Share2, Printer, Loader2, LogOut, LogIn, Eye, EyeOff, Shield,
  UserCircle, KeyRound, Minus, Maximize2, Minimize2, AlertCircle
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from "recharts";

const STORAGE_KEY = "gst_billing_app_v1";

// Role permissions: what each role can access
const ROLE_ACCESS = {
  owner:   ["dashboard","invoices","newInvoice","invoiceDetail","products","customers","reports","settings","users"],
  admin:   ["dashboard","invoices","newInvoice","invoiceDetail","products","customers","reports","settings"],
  manager: ["dashboard","invoices","newInvoice","invoiceDetail","products","customers","reports"],
  cashier: ["dashboard","invoices","newInvoice","invoiceDetail","customers"],
};

const DEFAULT_USERS = [
  { id: "u1", name: "Admin", userId: "admin", password: "admin123", role: "owner", active: true },
];
const STATE_CODES = {
  "Andhra Pradesh": "37", "Arunachal Pradesh": "12", "Assam": "18", "Bihar": "10",
  "Chhattisgarh": "22", "Delhi": "07", "Goa": "30", "Gujarat": "24", "Haryana": "06",
  "Himachal Pradesh": "02", "Jharkhand": "20", "Karnataka": "29", "Kerala": "32",
  "Madhya Pradesh": "23", "Maharashtra": "27", "Manipur": "14", "Meghalaya": "17",
  "Mizoram": "15", "Nagaland": "13", "Odisha": "21", "Punjab": "03", "Rajasthan": "08",
  "Sikkim": "11", "Tamil Nadu": "33", "Telangana": "36", "Tripura": "16",
  "Uttar Pradesh": "09", "Uttarakhand": "05", "West Bengal": "19",
  "Andaman and Nicobar Islands": "35", "Chandigarh": "04", "Dadra and Nagar Haveli": "26",
  "Daman and Diu": "25", "Jammu and Kashmir": "01", "Ladakh": "38",
  "Lakshadweep": "31", "Puducherry": "34"
};
const INDIAN_STATES = Object.keys(STATE_CODES).sort();
// Returns "Tamil Nadu - 33" style string
const stateWithCode = (s) => s && STATE_CODES[s] ? `${s} - ${STATE_CODES[s]}` : (s || "");
const GST_RATES = [0, 5, 12, 18, 28];
const uid = () => Math.random().toString(36).slice(2, 10);
const inr = (n) => "₹" + (Math.round((n || 0) * 100) / 100).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const todayISO = () => new Date().toISOString().slice(0, 10);

// Indian financial year: Apr 1 – Mar 31
// e.g. date in 2026-07 → FY 2026-27 → "26-27"
function financialYear(dateStr) {
  const d = dateStr ? new Date(dateStr) : new Date();
  const y = d.getFullYear();
  const m = d.getMonth(); // 0-indexed; March = 2
  const startYear = m >= 3 ? y : y - 1;       // on/after April → current year starts FY
  return `${String(startYear).slice(2)}-${String(startYear + 1).slice(2)}`;
}

// Build invoice number: PREFIX/SEQ/FY  e.g. SVT/0001/26-27
function makeInvoiceNumber(prefix, seq, dateStr) {
  const p = (prefix || "INV").toUpperCase().trim();
  const fy = financialYear(dateStr);
  return `${p}/${String(seq).padStart(4, "0")}/${fy}`;
}

const seedData = () => ({
  business: { name: "Sri Lakshmi Traders", gstin: "33AAAPL1234C1Z5", state: "Tamil Nadu", address: "12 Mount Road, Chennai", phone: "+91 98765 43210", invoicePrefix: "SVT", email: "", bankName: "", accountName: "", accountNo: "", ifsc: "", declaration: "We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct." },
  users: DEFAULT_USERS,
  products: [
    { id: uid(), name: "Cotton Saree", hsn: "5407", category: "Textile", brand: "Generic", purchasePrice: 800, sellingPrice: 1200, gst: 5, stock: 24, lowStock: 5, unit: "pc" },
    { id: uid(), name: "Steel Tiffin Box", hsn: "7323", category: "Kitchenware", brand: "Milton", purchasePrice: 250, sellingPrice: 399, gst: 18, stock: 3, lowStock: 5, unit: "pc" },
    { id: uid(), name: "Basmati Rice 5kg", hsn: "1006", category: "Grocery", brand: "India Gate", purchasePrice: 420, sellingPrice: 540, gst: 5, stock: 40, lowStock: 10, unit: "bag" },
    { id: uid(), name: "LED Bulb 9W", hsn: "8539", category: "Electricals", brand: "Philips", purchasePrice: 60, sellingPrice: 120, gst: 12, stock: 60, lowStock: 15, unit: "pc" },
  ],
  customers: [
    { id: uid(), name: "Ramesh Kumar", gstin: "33BBBPK5678D1Z2", phone: "+91 90000 11111", address: "Anna Nagar, Chennai", state: "Tamil Nadu" },
    { id: uid(), name: "Priya Textiles", gstin: "29CCCPT4321E1Z8", phone: "+91 90000 22222", address: "MG Road, Bengaluru", state: "Karnataka" },
  ],
  invoices: [],
  invoiceSeq: 1,
});

function gstSplit(taxable, rate, sameState) {
  const total = (taxable * rate) / 100;
  return sameState ? { cgst: total / 2, sgst: total / 2, igst: 0 } : { cgst: 0, sgst: 0, igst: total };
}

function computeInvoice(items, businessState, customerState, roundOff) {
  const sameState = businessState === customerState;
  let subtotal = 0, discountTotal = 0, taxable = 0, cgst = 0, sgst = 0, igst = 0;
  const lines = items.map((it) => {
    const lineSub = it.qty * it.rate;
    const lineDisc = (lineSub * (it.discountPercent || 0)) / 100;
    const lineTaxable = lineSub - lineDisc;
    const split = gstSplit(lineTaxable, it.gst, sameState);
    const lineTotal = lineTaxable + split.cgst + split.sgst + split.igst;
    subtotal += lineSub; discountTotal += lineDisc; taxable += lineTaxable;
    cgst += split.cgst; sgst += split.sgst; igst += split.igst;
    return { ...it, lineSub, lineDisc, lineTaxable, ...split, lineTotal };
  });
  const rawTotal = taxable + cgst + sgst + igst;
  const rounded = Math.round(rawTotal);
  const grandTotal = roundOff ? rounded : rawTotal;
  const roundOffAmt = roundOff ? rounded - rawTotal : 0;
  return { lines, subtotal, discountTotal, taxable, cgst, sgst, igst, rawTotal, roundOffAmt, grandTotal, sameState };
}

// ---- PDF generation helpers ----
// jsPDF/html2canvas aren't bundled; they're loaded on demand from cdnjs the
// first time someone actually needs a PDF, so normal use of the app never
// pays for them.
function loadScriptOnce(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) return resolve();
    const s = document.createElement("script");
    s.src = src;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Failed to load " + src));
    document.head.appendChild(s);
  });
}

async function loadPdfLibs() {
  if (!window.html2canvas) {
    await loadScriptOnce("https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js");
  }
  if (!window.jspdf) {
    await loadScriptOnce("https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js");
  }
}

async function nodeToPdfBlob(node) {
  await loadPdfLibs();
  const canvas = await window.html2canvas(node, { scale: 2, backgroundColor: "#ffffff", useCORS: true });
  const imgData = canvas.toDataURL("image/png");
  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF({ unit: "pt", format: "a4" });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const imgWidth = pageWidth;
  const imgHeight = (canvas.height * imgWidth) / canvas.width;
  let heightLeft = imgHeight;
  let position = 0;
  pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
  heightLeft -= pageHeight;
  while (heightLeft > 0) {
    position = heightLeft - imgHeight;
    pdf.addPage();
    pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;
  }
  return pdf.output("blob");
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

async function sharePdfBlob(blob, filename) {
  const file = new File([blob], filename, { type: "application/pdf" });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    await navigator.share({ files: [file], title: filename });
    return "shared";
  }
  downloadBlob(blob, filename);
  return "downloaded";
}

// ---- Auth helpers ----
// Session is kept in memory (React state) ONLY — never written to storage.
// This means every time the app is opened/refreshed, login is required.
// Only the logout action explicitly clears the session (which is already null).
function useAuth(users) {
  const [session, setSession] = useState(null);
  const [authLoaded, setAuthLoaded] = useState(true); // no async load needed

  const login = async (userId, password) => {
    const user = (users || DEFAULT_USERS).find(
      (u) => u.userId === userId.trim() && u.password === password && u.active
    );
    if (!user) return false;
    const s = { id: user.id, name: user.name, userId: user.userId, role: user.role };
    setSession(s);
    return true;
  };

  const logout = () => {
    setSession(null);
  };

  return { session, authLoaded, login, logout };
}

function LoginScreen({ onLogin, dark, setDark }) {
  const [userId, setUserId] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!userId || !password) { setError("Please enter User ID and password."); return; }
    setLoading(true); setError("");
    const ok = await onLogin(userId, password);
    setLoading(false);
    if (!ok) setError("Invalid User ID or password. Please try again.");
  };

  return (
    <div className={`min-h-screen flex flex-col items-center justify-center p-4 ${dark ? "bg-stone-950" : "bg-gradient-to-br from-indigo-950 via-indigo-900 to-indigo-800"}`}>
      <style>{`.font-display{font-family:"Fraunces",serif;}`}</style>

      {/* Dark mode toggle */}
      <button onClick={() => setDark(d => !d)} className="absolute top-4 right-4 text-white/60 hover:text-white">
        {dark ? <Sun size={18} /> : <Moon size={18} />}
      </button>

      {/* Card */}
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="bg-indigo-950 px-6 py-8 text-center">
          <div className="w-14 h-14 rounded-2xl bg-amber-500 flex items-center justify-center text-indigo-950 font-bold text-xl mx-auto mb-3">GST</div>
          <p className="font-display text-white text-2xl">BillBook</p>
          <p className="text-indigo-300 text-sm mt-1">GST Billing Application</p>
        </div>

        {/* Form */}
        <div className="px-6 py-6">
          <p className="text-stone-700 font-semibold text-base mb-4 flex items-center gap-2"><LogIn size={16} /> Admin Login</p>

          <label className="block mb-3">
            <span className="text-xs text-stone-500 mb-1 block">User ID</span>
            <div className="relative">
              <UserCircle size={15} className="absolute left-3 top-2.5 text-stone-400" />
              <input className="w-full border border-stone-300 rounded-lg px-3 py-2 pl-9 text-sm outline-none focus:ring-2 focus:ring-amber-500 bg-white text-stone-900"
                placeholder="Enter your user ID" value={userId}
                onChange={(e) => { setUserId(e.target.value); setError(""); }}
                onKeyDown={(e) => e.key === "Enter" && handleLogin()} />
            </div>
          </label>

          <label className="block mb-4">
            <span className="text-xs text-stone-500 mb-1 block">Password</span>
            <div className="relative">
              <KeyRound size={15} className="absolute left-3 top-2.5 text-stone-400" />
              <input type={showPw ? "text" : "password"}
                className="w-full border border-stone-300 rounded-lg px-3 py-2 pl-9 pr-9 text-sm outline-none focus:ring-2 focus:ring-amber-500 bg-white text-stone-900"
                placeholder="Enter your password" value={password}
                onChange={(e) => { setPassword(e.target.value); setError(""); }}
                onKeyDown={(e) => e.key === "Enter" && handleLogin()} />
              <button type="button" onClick={() => setShowPw(s => !s)} className="absolute right-3 top-2.5 text-stone-400 hover:text-stone-600">
                {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </label>

          {error && <p className="text-xs text-red-600 mb-3 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}

          <button onClick={handleLogin} disabled={loading}
            className="w-full flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-60 text-indigo-950 font-semibold text-sm py-3 rounded-lg">
            {loading ? <Loader2 size={16} className="animate-spin" /> : <LogIn size={16} />}
            {loading ? "Signing in…" : "Sign In"}
          </button>
        </div>

        <div className="px-6 pb-6">
          <p className="text-[11px] text-stone-400 text-center">Default: &nbsp;<strong>admin</strong> / <strong>admin123</strong> &nbsp;·&nbsp; Change in Settings → Users</p>
        </div>
      </div>
    </div>
  );
}

// Storage is plain browser localStorage — this app runs entirely offline,
// with all data kept on the machine it's installed on.
function useAppData() {
  const [data, setData] = useState(seedData());
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) setData(JSON.parse(raw));
    } catch (e) { /* no saved data yet */ }
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    const t = setTimeout(() => {
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      } catch (e) { /* storage full or unavailable */ }
    }, 300);
    return () => clearTimeout(t);
  }, [data, loaded]);

  return [data, setData, loaded];
}

const NAV = [
  { key: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { key: "invoices", label: "Invoices", icon: FileText },
  { key: "products", label: "Products", icon: Package },
  { key: "customers", label: "Customers", icon: Users },
  { key: "reports", label: "Reports", icon: BarChart3 },
  { key: "users", label: "Users", icon: Shield },
  { key: "settings", label: "Settings", icon: Settings },
];

// ─── Window Frame ───────────────────────────────────────────────────────────
function WindowFrame({ children, isDark, onToggleDark }) {
  const [minimized,  setMinimized]  = useState(false);
  const [maximized,  setMaximized]  = useState(true);   // start maximised
  const [showClose,  setShowClose]  = useState(false);   // close-confirm dialog
  const [closing,    setClosing]    = useState(false);   // fade-out animation
  const [closed,     setClosed]     = useState(false);   // completely gone

  // ── window state helpers ──────────────────────────────────────────────────
  const handleMinimize = () => setMinimized(true);
  const handleRestore  = () => setMinimized(false);
  const handleMaximize = () => setMaximized(m => !m);
  const handleCloseRequest = () => setShowClose(true);
  const handleCloseCancel  = () => setShowClose(false);
  const handleCloseConfirm = () => {
    setShowClose(false);
    setClosing(true);
    setTimeout(() => setClosed(true), 400);
  };

  // ── completely closed ─────────────────────────────────────────────────────
  if (closed) {
    return (
      <div className="fixed inset-0 bg-stone-900 flex flex-col items-center justify-center select-none">
        <div className="w-16 h-16 rounded-2xl bg-amber-500 flex items-center justify-center text-indigo-950 font-bold text-2xl mb-4">GST</div>
        <p className="text-white font-semibold text-lg mb-1">BillBook is closed</p>
        <p className="text-stone-400 text-sm mb-6">Your data has been saved automatically.</p>
        <button onClick={() => { setClosed(false); setClosing(false); setMinimized(false); }}
          className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-indigo-950 font-semibold text-sm rounded-lg">
          Reopen App
        </button>
      </div>
    );
  }

  // ── taskbar (shown when minimised) ────────────────────────────────────────
  const Taskbar = () => (
    <div className="fixed bottom-0 left-0 right-0 h-12 bg-stone-800 border-t border-stone-700 flex items-center px-3 gap-2 z-50">
      <button onClick={handleRestore}
        className="flex items-center gap-2 bg-indigo-700 hover:bg-indigo-600 text-white text-xs font-medium px-3 py-1.5 rounded">
        <div className="w-4 h-4 rounded bg-amber-500 flex items-center justify-center text-[9px] font-bold text-indigo-950">G</div>
        GST BillBook
      </button>
      <p className="text-stone-500 text-xs ml-2">— minimised</p>
    </div>
  );

  if (minimized) return <><div className="fixed inset-0 bg-stone-900" /><Taskbar /></>;

  // ── window size classes ───────────────────────────────────────────────────
  const winCls = maximized
    ? "fixed inset-0 z-10 flex flex-col"
    : "fixed top-8 left-8 right-8 bottom-8 z-10 flex flex-col rounded-xl shadow-2xl overflow-hidden";

  return (
    <>
      {/* ── closing fade overlay ── */}
      {closing && (
        <div className="fixed inset-0 bg-black z-50 animate-pulse" style={{ animation: "fadeOut 0.4s ease forwards" }} />
      )}
      <style>{`
        @keyframes fadeOut { from { opacity:0 } to { opacity:1 } }
        @keyframes slideIn { from { opacity:0; transform:scale(0.97) } to { opacity:1; transform:scale(1) } }
        .win-appear { animation: slideIn 0.2s ease; }
      `}</style>

      <div className={`${winCls} win-appear`} style={{ background: "#1e1b4b" }}>

        {/* ── Title bar ─────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-3 py-0 select-none shrink-0"
          style={{ height: 38, background: "linear-gradient(90deg,#1e1b4b 0%,#312e81 100%)", borderBottom: "1px solid #3730a3" }}>

          {/* Left: logo + title */}
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded bg-amber-500 flex items-center justify-center text-[9px] font-bold text-indigo-950">G</div>
            <span className="text-white text-xs font-semibold tracking-wide">GST BillBook — Billing Application</span>
          </div>

          {/* Right: dark mode + window controls */}
          <div className="flex items-center gap-1">
            {/* Dark mode toggle */}
            <button onClick={onToggleDark} title={isDark ? "Light mode" : "Dark mode"}
              className="flex items-center gap-1 px-2 h-7 text-indigo-200 hover:bg-indigo-700/60 rounded text-[11px] transition mr-2">
              {isDark ? <Sun size={13} /> : <Moon size={13} />}
              <span className="hidden sm:inline">{isDark ? "Light" : "Dark"}</span>
            </button>

            {/* Separator */}
            <div style={{ width: 1, height: 20, background: "#4338ca", marginRight: 4 }} />

            {/* Minimize */}
            <button onClick={handleMinimize} title="Minimize (hide app)"
              className="flex items-center gap-1 w-9 h-8 justify-center text-indigo-200 hover:bg-indigo-700/60 transition rounded"
              style={{ fontSize: 11 }}>
              <Minus size={14} />
            </button>
            {/* Small window / Maximize */}
            <button onClick={handleMaximize} title={maximized ? "Small window" : "Maximize"}
              className="flex items-center gap-1 w-9 h-8 justify-center text-indigo-200 hover:bg-indigo-700/60 transition rounded"
              style={{ fontSize: 11 }}>
              {maximized ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
            </button>
            {/* Close */}
            <button onClick={handleCloseRequest} title="Close application"
              className="flex items-center gap-1 w-9 h-8 justify-center text-indigo-200 hover:bg-red-600 hover:text-white transition rounded"
              style={{ fontSize: 11 }}>
              <X size={14} />
            </button>
          </div>
        </div>

        {/* ── App content ───────────────────────────────────────────────── */}
        <div className="flex-1 overflow-auto">
          {children}
        </div>

        {/* ── Status bar ────────────────────────────────────────────────── */}
        <div className="shrink-0 flex items-center justify-between px-4 text-[11px]"
          style={{ height: 24, background: "#1e1b4b", borderTop: "1px solid #312e81", color: "#818cf8" }}>
          <span>GST BillBook v1.0 · Ready</span>
          <span>{new Date().toLocaleDateString("en-IN", { day:"2-digit", month:"short", year:"numeric" })}</span>
        </div>
      </div>

      {/* ── Close confirmation dialog ──────────────────────────────────── */}
      {showClose && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-80 overflow-hidden">
            {/* Dialog title bar */}
            <div className="bg-indigo-950 px-4 py-3 flex items-center gap-2">
              <AlertCircle size={16} className="text-amber-400" />
              <p className="text-white text-sm font-semibold">Close GST BillBook?</p>
            </div>
            {/* Dialog body */}
            <div className="px-5 py-5">
              <p className="text-stone-700 text-sm mb-1">Are you sure you want to close the application?</p>
              <p className="text-stone-500 text-xs">All your data has been saved automatically.</p>
            </div>
            {/* Dialog actions */}
            <div className="flex border-t border-stone-200">
              <button onClick={handleCloseCancel}
                className="flex-1 py-3 text-sm font-medium text-stone-600 hover:bg-stone-50 transition border-r border-stone-200">
                Cancel
              </button>
              <button onClick={handleCloseConfirm}
                className="flex-1 py-3 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 transition rounded-br-2xl">
                Yes, Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default function GSTBillingApp() {
  const [data, setData, loaded] = useAppData();
  const [dark, setDark] = useState(false);
  const [view, setView] = useState("dashboard");
  const [navOpen, setNavOpen] = useState(false);
  const [editingInvoiceDraft, setEditingInvoiceDraft] = useState(null);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState(null);
  const { session, authLoaded, login, logout } = useAuth(data.users);

  const canAccess = (key) => session && (ROLE_ACCESS[session.role] || []).includes(key);

  const T = dark
    ? { bg: "bg-stone-950", panel: "bg-stone-900", card: "bg-stone-900", border: "border-stone-800", text: "text-stone-100", sub: "text-stone-400", hover: "hover:bg-stone-800", input: "bg-stone-800 border-stone-700 text-stone-100", sidebar: "bg-indigo-950", sidebarText: "text-indigo-200", sidebarActive: "bg-indigo-900 text-white", accent: "text-amber-400" }
    : { bg: "bg-stone-50", panel: "bg-white", card: "bg-white", border: "border-stone-200", text: "text-stone-900", sub: "text-stone-500", hover: "hover:bg-stone-100", input: "bg-white border-stone-300 text-stone-900", sidebar: "bg-indigo-950", sidebarText: "text-indigo-200", sidebarActive: "bg-indigo-900 text-white", accent: "text-amber-600" };

  const goNewInvoice = () => { setEditingInvoiceDraft(null); setView("newInvoice"); };

  if (!loaded || !authLoaded) {
    return (
      <WindowFrame isDark={dark} onToggleDark={() => setDark(d => !d)}>
        <div className="min-h-screen flex items-center justify-center bg-indigo-950 text-white text-sm">Loading…</div>
      </WindowFrame>
    );
  }

  if (!session) {
    return (
      <WindowFrame isDark={dark} onToggleDark={() => setDark(d => !d)}>
        <LoginScreen onLogin={login} dark={dark} setDark={setDark} />
      </WindowFrame>
    );
  }

  return (
    <WindowFrame isDark={dark} onToggleDark={() => setDark(d => !d)}>
    <div className={`w-full min-h-full flex ${T.bg} ${T.text}`} style={{ fontFamily: "Inter, ui-sans-serif, system-ui" }}>
      <style>{`.font-display{font-family:"Fraunces",serif;}
        ::-webkit-scrollbar{width:8px;height:8px} ::-webkit-scrollbar-thumb{background:#a8a29e;border-radius:8px}`}</style>

      {/* Sidebar (desktop) */}
      <aside className={`hidden md:flex md:flex-col w-56 shrink-0 ${T.sidebar} ${T.sidebarText} p-4`}>
        <div className="flex items-center gap-2 px-2 py-3 mb-4">
          <div className="w-8 h-8 rounded-lg bg-amber-500 flex items-center justify-center text-indigo-950 font-bold text-sm">GST</div>
          <div>
            <p className="font-display text-white text-base leading-tight">BillBook</p>
            <p className="text-[11px] text-indigo-300">GST Billing</p>
          </div>
        </div>

        {/* Logged in user */}
        <div className="bg-indigo-900/50 rounded-lg px-3 py-2 mb-4">
          <p className="text-white text-xs font-semibold truncate">{session.name}</p>
          <p className="text-indigo-300 text-[11px] capitalize">{session.role} · {session.userId}</p>
        </div>

        <nav className="flex-1 space-y-1">
          {NAV.filter(n => canAccess(n.key)).map((n) => (
            <button key={n.key} onClick={() => setView(n.key)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition ${view === n.key || (n.key === "invoices" && view === "newInvoice") ? T.sidebarActive : "hover:bg-indigo-900/60"}`}>
              <n.icon size={17} /> {n.label}
            </button>
          ))}
        </nav>
        {canAccess("newInvoice") && (
          <button onClick={goNewInvoice} className="mt-2 flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-400 text-indigo-950 font-semibold text-sm py-2.5 rounded-lg transition">
            <Plus size={16} /> New invoice
          </button>
        )}
        <button onClick={logout} className="mt-2 flex items-center justify-center gap-2 text-indigo-300 hover:text-white text-xs py-2 rounded-lg hover:bg-indigo-900/60 transition">
          <LogOut size={14} /> Sign out
        </button>
      </aside>

      {/* Mobile top bar */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-20">
        <div className={`flex items-center justify-between px-4 py-3 ${T.sidebar} text-white`}>
          <button onClick={() => setNavOpen(true)}><Menu size={22} /></button>
          <p className="font-display text-base">BillBook</p>
          <button onClick={() => setDark((d) => !d)}>{dark ? <Sun size={18} /> : <Moon size={18} />}</button>
        </div>
      </div>
      {navOpen && (
        <div className="md:hidden fixed inset-0 z-30 flex">
          <div className={`w-64 ${T.sidebar} ${T.sidebarText} p-4 flex flex-col`}>
            <div className="flex items-center justify-between mb-2">
              <p className="font-display text-white text-base">BillBook</p>
              <button onClick={() => setNavOpen(false)}><X size={20} className="text-white" /></button>
            </div>
            <div className="bg-indigo-900/50 rounded-lg px-3 py-2 mb-3">
              <p className="text-white text-xs font-semibold">{session.name}</p>
              <p className="text-indigo-300 text-[11px] capitalize">{session.role}</p>
            </div>
            {NAV.filter(n => canAccess(n.key)).map((n) => (
              <button key={n.key} onClick={() => { setView(n.key); setNavOpen(false); }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm mb-1 ${view === n.key ? T.sidebarActive : "hover:bg-indigo-900/60"}`}>
                <n.icon size={17} /> {n.label}
              </button>
            ))}
            <div className="flex-1" />
            <button onClick={() => { logout(); setNavOpen(false); }} className="flex items-center gap-2 text-indigo-300 hover:text-white text-sm py-2 px-3 rounded-lg hover:bg-indigo-900/60">
              <LogOut size={15} /> Sign out
            </button>
          </div>
          <div className="flex-1 bg-black/40" onClick={() => setNavOpen(false)} />
        </div>
      )}

      {/* Main content */}
      <main className="flex-1 min-w-0 pt-14 md:pt-0 pb-20 md:pb-0">
        <div className="max-w-6xl mx-auto p-4 md:p-8">

          {view === "dashboard" && (
            <PageFrame T={T} title="Dashboard" icon={LayoutDashboard} onClose={() => setView("dashboard")}>
              <Dashboard T={T} data={data} setView={setView} goNewInvoice={goNewInvoice} setSelectedInvoiceId={setSelectedInvoiceId} canAccess={canAccess} />
            </PageFrame>
          )}
          {view === "products" && (
            <PageFrame T={T} title="Products" icon={Package} onClose={() => setView("dashboard")}>
              <Products T={T} data={data} setData={setData} />
            </PageFrame>
          )}
          {view === "customers" && (
            <PageFrame T={T} title="Customers" icon={Users} onClose={() => setView("dashboard")}>
              <Customers T={T} data={data} setData={setData} />
            </PageFrame>
          )}
          {view === "invoices" && (
            <PageFrame T={T} title="Invoices" icon={FileText} onClose={() => setView("dashboard")}>
              <InvoiceList T={T} data={data} setEditingInvoiceDraft={setEditingInvoiceDraft} setView={setView} setData={setData} setSelectedInvoiceId={setSelectedInvoiceId} />
            </PageFrame>
          )}
          {view === "newInvoice" && canAccess("newInvoice") && (
            <PageFrame T={T} title={editingInvoiceDraft?.id ? "Edit Invoice" : "New Invoice"} icon={Receipt} onClose={() => setView("invoices")}>
              <NewInvoice T={T} data={data} setData={setData} setView={setView} draft={editingInvoiceDraft} setSelectedInvoiceId={setSelectedInvoiceId} />
            </PageFrame>
          )}
          {view === "invoiceDetail" && (
            <PageFrame T={T} title="Invoice Detail" icon={FileText} onClose={() => setView("invoices")}>
              <InvoiceDetail T={T} data={data} setData={setData} invoiceId={selectedInvoiceId} setView={setView} setEditingInvoiceDraft={setEditingInvoiceDraft} canAccess={canAccess} />
            </PageFrame>
          )}
          {view === "reports" && (
            <PageFrame T={T} title="Reports & Analytics" icon={BarChart3} onClose={() => setView("dashboard")}>
              <Reports T={T} data={data} />
            </PageFrame>
          )}
          {view === "users" && canAccess("users") && (
            <PageFrame T={T} title="Users & Access" icon={Shield} onClose={() => setView("dashboard")}>
              <UsersView T={T} data={data} setData={setData} session={session} />
            </PageFrame>
          )}
          {view === "settings" && (
            <PageFrame T={T} title="Settings" icon={Settings} onClose={() => setView("dashboard")}>
              <SettingsView T={T} data={data} setData={setData} />
            </PageFrame>
          )}
        </div>
      </main>

      {/* Bottom nav (mobile) */}
      <div className={`md:hidden fixed bottom-0 left-0 right-0 z-20 ${T.panel} border-t ${T.border} flex`}>
        {NAV.filter(n => canAccess(n.key) && n.key !== "users").slice(0, 5).map((n) => (
          <button key={n.key} onClick={() => setView(n.key)} className={`flex-1 flex flex-col items-center gap-0.5 py-2 text-[11px] ${view === n.key ? "text-amber-600 font-semibold" : T.sub}`}>
            <n.icon size={18} /> {n.label}
          </button>
        ))}
      </div>
      {canAccess("newInvoice") && (
        <button onClick={goNewInvoice} className="md:hidden fixed bottom-16 right-4 z-20 w-12 h-12 rounded-full bg-amber-500 text-indigo-950 flex items-center justify-center shadow-lg">
          <Plus size={22} />
        </button>
      )}
    </div>
  </WindowFrame>
  );
}

// ── Per-page frame with minimize / restore / close controls ──────────────────
function PageFrame({ T, title, icon: Icon, onClose, children }) {
  const [minimized, setMinimized] = useState(false);
  const [small, setSmall] = useState(false);

  return (
    <div className={`${T.card} border ${T.border} rounded-xl overflow-hidden mb-4 transition-all ${small ? "max-w-md" : "w-full"}`}>
      {/* Title bar */}
      <div className={`flex items-center justify-between px-4 py-2 border-b ${T.border} bg-indigo-950`}>
        <div className="flex items-center gap-2 text-white">
          {Icon && <Icon size={14} />}
          <span className="text-xs font-semibold tracking-wide">{title}</span>
        </div>
        <div className="flex items-center gap-1">
          {/* Minimize */}
          <button onClick={() => setMinimized(m => !m)} title={minimized ? "Restore" : "Minimize"}
            className="w-7 h-7 flex items-center justify-center rounded hover:bg-indigo-700 text-indigo-300 hover:text-white transition">
            <Minus size={12} />
          </button>
          {/* Small window */}
          <button onClick={() => setSmall(s => !s)} title={small ? "Expand" : "Small window"}
            className="w-7 h-7 flex items-center justify-center rounded hover:bg-indigo-700 text-indigo-300 hover:text-white transition">
            {small ? <Maximize2 size={12} /> : <Minimize2 size={12} />}
          </button>
          {/* Close — goes back to dashboard */}
          <button onClick={onClose} title="Close"
            className="w-7 h-7 flex items-center justify-center rounded hover:bg-red-600 text-indigo-300 hover:text-white transition">
            <X size={12} />
          </button>
        </div>
      </div>
      {/* Content — hidden when minimized */}
      {!minimized && (
        <div className="p-4 md:p-6 overflow-auto">
          {children}
        </div>
      )}
      {minimized && (
        <div className={`px-4 py-2 text-xs ${T.sub} flex items-center gap-2`}>
          <span>— minimised —</span>
          <button onClick={() => setMinimized(false)} className="text-amber-600 font-medium underline">Restore</button>
        </div>
      )}
    </div>
  );
}

function StatCard({ T, icon: Icon, label, value, tone = "default" }) {
  const toneClasses = { default: "text-indigo-600", warn: "text-red-600", good: "text-emerald-600" };
  return (
    <div className={`${T.card} border ${T.border} rounded-xl p-4`}>
      <div className="flex items-center justify-between mb-2">
        <p className={`text-xs ${T.sub}`}>{label}</p>
        <Icon size={16} className={toneClasses[tone]} />
      </div>
      <p className="text-xl font-semibold">{value}</p>
    </div>
  );
}

function Dashboard({ T, data, setView, goNewInvoice, setSelectedInvoiceId, canAccess }) {
  const today = todayISO();
  const thisMonth = today.slice(0, 7);
  const todaySales = data.invoices.filter((i) => i.date === today).reduce((s, i) => s + i.totals.grandTotal, 0);
  const monthSales = data.invoices.filter((i) => i.date.startsWith(thisMonth)).reduce((s, i) => s + i.totals.grandTotal, 0);
  const totalRevenue = data.invoices.reduce((s, i) => s + i.totals.grandTotal, 0);
  const profit = data.invoices.reduce((s, inv) => {
    const cost = inv.totals.lines.reduce((c, l) => {
      const p = data.products.find((p) => p.id === l.productId);
      return c + (p ? p.purchasePrice * l.qty : 0);
    }, 0);
    return s + (inv.totals.grandTotal - cost);
  }, 0);
  const pending = data.invoices.filter((i) => i.status === "pending").reduce((s, i) => s + i.totals.grandTotal, 0);
  const lowStock = data.products.filter((p) => p.stock <= p.lowStock);
  const recent = [...data.invoices].sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 5);
  const salesByProduct = {};
  data.invoices.forEach((inv) => inv.totals.lines.forEach((l) => { salesByProduct[l.name] = (salesByProduct[l.name] || 0) + l.qty; }));
  const topProducts = Object.entries(salesByProduct).sort((a, b) => b[1] - a[1]).slice(0, 5);

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="font-display text-2xl">Dashboard</h1>
          <p className={`text-sm ${T.sub}`}>{data.business.name} · welcome back</p>
        </div>
        <div className="hidden md:flex gap-2">
          <button onClick={goNewInvoice} className="flex items-center gap-2 bg-indigo-950 text-white text-sm px-3 py-2 rounded-lg hover:bg-indigo-900"><Receipt size={15} /> New invoice</button>
          <button onClick={() => setView("customers")} className={`flex items-center gap-2 border ${T.border} text-sm px-3 py-2 rounded-lg ${T.hover}`}><Users size={15} /> Add customer</button>
          <button onClick={() => setView("products")} className={`flex items-center gap-2 border ${T.border} text-sm px-3 py-2 rounded-lg ${T.hover}`}><Package size={15} /> Add product</button>
        </div>
      </div>

      <div className="md:hidden flex gap-2 mb-5 overflow-x-auto pb-1 -mx-4 px-4">
        <button onClick={goNewInvoice} className="shrink-0 flex items-center gap-1.5 bg-indigo-950 text-white text-xs px-3 py-2 rounded-lg"><Receipt size={13} /> New invoice</button>
        <button onClick={() => setView("customers")} className={`shrink-0 flex items-center gap-1.5 border ${T.border} text-xs px-3 py-2 rounded-lg`}><Users size={13} /> Add customer</button>
        <button onClick={() => setView("products")} className={`shrink-0 flex items-center gap-1.5 border ${T.border} text-xs px-3 py-2 rounded-lg`}><Package size={13} /> Add product</button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
        <StatCard T={T} icon={IndianRupee} label="Today's sales" value={inr(todaySales)} />
        <StatCard T={T} icon={TrendingUp} label="Monthly sales" value={inr(monthSales)} />
        <StatCard T={T} icon={IndianRupee} label="Total revenue" value={inr(totalRevenue)} />
        <StatCard T={T} icon={TrendingUp} label="Profit" value={inr(profit)} tone="good" />
        <StatCard T={T} icon={Clock} label="Pending payments" value={inr(pending)} tone="warn" />
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        <div className={`md:col-span-2 ${T.card} border ${T.border} rounded-xl p-4`}>
          <div className="flex items-center justify-between mb-3">
            <p className="font-medium text-sm">Recent transactions</p>
            <button onClick={() => setView("invoices")} className={`text-xs ${T.accent} flex items-center gap-1`}>View all <ChevronRight size={13} /></button>
          </div>
          {recent.length === 0 && <p className={`text-sm ${T.sub} py-6 text-center`}>No invoices yet. Create your first one.</p>}
          <div className="space-y-2">
            {recent.map((inv) => (
              <div key={inv.id} onClick={() => { setSelectedInvoiceId(inv.id); setView("invoiceDetail"); }} className={`flex items-center justify-between py-2 border-b ${T.border} last:border-0 cursor-pointer ${T.hover} -mx-2 px-2 rounded`}>
                <div>
                  <p className="text-sm font-medium">{inv.number} · {inv.customerName}</p>
                  <p className={`text-xs ${T.sub}`}>{inv.date}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold">{inr(inv.totals.grandTotal)}</p>
                  <span className={`text-[11px] px-1.5 py-0.5 rounded ${inv.status === "paid" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>{inv.status}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <div className={`${T.card} border ${T.border} rounded-xl p-4`}>
            <div className="flex items-center gap-2 mb-3"><AlertTriangle size={15} className="text-red-500" /><p className="font-medium text-sm">Low stock alerts</p></div>
            {lowStock.length === 0 && <p className={`text-xs ${T.sub}`}>All products are well stocked.</p>}
            {lowStock.map((p) => (
              <div key={p.id} className="flex items-center justify-between text-sm py-1">
                <span>{p.name}</span>
                <span className="text-red-600 font-medium">{p.stock} {p.unit} left</span>
              </div>
            ))}
          </div>
          <div className={`${T.card} border ${T.border} rounded-xl p-4`}>
            <p className="font-medium text-sm mb-3">Top selling products</p>
            {topProducts.length === 0 && <p className={`text-xs ${T.sub}`}>No sales recorded yet.</p>}
            {topProducts.map(([name, qty]) => (
              <div key={name} className="flex items-center justify-between text-sm py-1">
                <span>{name}</span>
                <span className={T.sub}>{qty} sold</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function Modal({ T, title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-black/40" onClick={onClose}>
      <div className={`w-full max-w-md ${T.panel} rounded-xl border ${T.border} p-5 max-h-[85vh] overflow-y-auto`} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <p className="font-display text-lg">{title}</p>
          <button onClick={onClose}><X size={18} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Field({ T, label, children }) {
  return <label className="block mb-3"><span className={`text-xs ${T.sub} mb-1 block`}>{label}</span>{children}</label>;
}
const inputCls = (T) => `w-full border ${T.input} rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-amber-500`;

function Products({ T, data, setData }) {
  const [query, setQuery] = useState("");
  const [modal, setModal] = useState(null); // product being edited or {} for new
  const filtered = data.products.filter((p) => p.name.toLowerCase().includes(query.toLowerCase()) || p.category.toLowerCase().includes(query.toLowerCase()));

  const save = (p) => {
    setData((d) => {
      const exists = d.products.some((x) => x.id === p.id);
      const products = exists ? d.products.map((x) => (x.id === p.id ? p : x)) : [...d.products, { ...p, id: uid() }];
      return { ...d, products };
    });
    setModal(null);
  };
  const remove = (id) => setData((d) => ({ ...d, products: d.products.filter((p) => p.id !== id) }));

  return (
    <div>
      <div className="flex items-center justify-between mb-4 gap-3">
        <h1 className="font-display text-2xl">Products</h1>
        <button onClick={() => setModal({ name: "", hsn: "", category: "", brand: "", purchasePrice: 0, sellingPrice: 0, gst: 18, stock: 0, lowStock: 5, unit: "pc" })}
          className="flex items-center gap-2 bg-indigo-950 text-white text-sm px-3 py-2 rounded-lg hover:bg-indigo-900"><Plus size={15} /> Add product</button>
      </div>
      <div className="relative mb-4 max-w-sm">
        <Search size={15} className={`absolute left-3 top-2.5 ${T.sub}`} />
        <input className={inputCls(T) + " pl-9"} placeholder="Search products" value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {filtered.map((p) => (
          <div key={p.id} className={`${T.card} border ${T.border} rounded-xl p-4`}>
            <div className="flex items-start justify-between mb-1">
              <p className="font-medium text-sm">{p.name}</p>
              <div className="flex gap-2">
                <button onClick={() => setModal(p)}><Edit2 size={14} className={T.sub} /></button>
                <button onClick={() => remove(p.id)}><Trash2 size={14} className="text-red-500" /></button>
              </div>
            </div>
            <p className={`text-xs ${T.sub} mb-2`}>{p.category} · HSN {p.hsn} · GST {p.gst}%</p>
            <div className="flex items-center justify-between text-sm">
              <span className="font-semibold">{inr(p.sellingPrice)}</span>
              <span className={p.stock <= p.lowStock ? "text-red-600 font-medium" : T.sub}>{p.stock} {p.unit} in stock</span>
            </div>
          </div>
        ))}
        {filtered.length === 0 && <p className={`text-sm ${T.sub} col-span-full text-center py-10`}>No products found.</p>}
      </div>

      {modal && (
        <Modal T={T} title={modal.id ? "Edit product" : "Add product"} onClose={() => setModal(null)}>
          <ProductForm T={T} value={modal} onSave={save} />
        </Modal>
      )}
    </div>
  );
}

function ProductForm({ T, value, onSave }) {
  const [f, setF] = useState(value);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const setNum = (k) => (e) => setF({ ...f, [k]: Number(e.target.value) });
  return (
    <div>
      <Field T={T} label="Product name"><input className={inputCls(T)} value={f.name} onChange={set("name")} /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field T={T} label="HSN/SAC code"><input className={inputCls(T)} value={f.hsn} onChange={set("hsn")} /></Field>
        <Field T={T} label="Category"><input className={inputCls(T)} value={f.category} onChange={set("category")} /></Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field T={T} label="Brand"><input className={inputCls(T)} value={f.brand} onChange={set("brand")} /></Field>
        <Field T={T} label="Unit"><input className={inputCls(T)} value={f.unit} onChange={set("unit")} placeholder="pc, kg, box" /></Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field T={T} label="Purchase price (₹)"><input type="number" className={inputCls(T)} value={f.purchasePrice} onChange={setNum("purchasePrice")} /></Field>
        <Field T={T} label="Selling price (₹)"><input type="number" className={inputCls(T)} value={f.sellingPrice} onChange={setNum("sellingPrice")} /></Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field T={T} label="GST %">
          <select className={inputCls(T)} value={f.gst} onChange={setNum("gst")}>
            {GST_RATES.map((r) => <option key={r} value={r}>{r}%</option>)}
          </select>
        </Field>
        <Field T={T} label="Stock quantity"><input type="number" className={inputCls(T)} value={f.stock} onChange={setNum("stock")} /></Field>
      </div>
      <Field T={T} label="Low stock alert threshold"><input type="number" className={inputCls(T)} value={f.lowStock} onChange={setNum("lowStock")} /></Field>
      <button onClick={() => f.name && onSave(f)} className="w-full mt-2 flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-400 text-indigo-950 font-semibold text-sm py-2.5 rounded-lg">
        <Save size={15} /> Save product
      </button>
    </div>
  );
}

function Customers({ T, data, setData }) {
  const [query, setQuery] = useState("");
  const [modal, setModal] = useState(null);
  const filtered = data.customers.filter((c) => c.name.toLowerCase().includes(query.toLowerCase()));

  const save = (c) => {
    setData((d) => {
      const exists = d.customers.some((x) => x.id === c.id);
      const customers = exists ? d.customers.map((x) => (x.id === c.id ? c : x)) : [...d.customers, { ...c, id: uid() }];
      return { ...d, customers };
    });
    setModal(null);
  };
  const remove = (id) => setData((d) => ({ ...d, customers: d.customers.filter((c) => c.id !== id) }));

  const outstanding = (customerId) => data.invoices.filter((i) => i.customerId === customerId && i.status === "pending").reduce((s, i) => s + i.totals.grandTotal, 0);
  const purchases = (customerId) => data.invoices.filter((i) => i.customerId === customerId).length;

  return (
    <div>
      <div className="flex items-center justify-between mb-4 gap-3">
        <h1 className="font-display text-2xl">Customers</h1>
        <button onClick={() => setModal({ name: "", gstin: "", phone: "", address: "", state: data.business.state })}
          className="flex items-center gap-2 bg-indigo-950 text-white text-sm px-3 py-2 rounded-lg hover:bg-indigo-900"><Plus size={15} /> Add customer</button>
      </div>
      <div className="relative mb-4 max-w-sm">
        <Search size={15} className={`absolute left-3 top-2.5 ${T.sub}`} />
        <input className={inputCls(T) + " pl-9"} placeholder="Search customers" value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {filtered.map((c) => (
          <div key={c.id} className={`${T.card} border ${T.border} rounded-xl p-4`}>
            <div className="flex items-start justify-between mb-1">
              <p className="font-medium text-sm">{c.name}</p>
              <div className="flex gap-2">
                <button onClick={() => setModal(c)}><Edit2 size={14} className={T.sub} /></button>
                <button onClick={() => remove(c.id)}><Trash2 size={14} className="text-red-500" /></button>
              </div>
            </div>
            <p className={`text-xs ${T.sub} mb-1`}>{c.state} · {c.phone}</p>
            <p className={`text-xs ${T.sub} mb-3`}>GSTIN: {c.gstin || "—"}</p>
            <div className="flex items-center justify-between text-sm">
              <span className={T.sub}>{purchases(c.id)} invoices</span>
              <span className={outstanding(c.id) > 0 ? "text-red-600 font-medium" : "text-emerald-600"}>{outstanding(c.id) > 0 ? inr(outstanding(c.id)) + " due" : "settled"}</span>
            </div>
          </div>
        ))}
        {filtered.length === 0 && <p className={`text-sm ${T.sub} col-span-full text-center py-10`}>No customers found.</p>}
      </div>

      {modal && (
        <Modal T={T} title={modal.id ? "Edit customer" : "Add customer"} onClose={() => setModal(null)}>
          <CustomerForm T={T} value={modal} onSave={save} />
        </Modal>
      )}
    </div>
  );
}

function CustomerForm({ T, value, onSave }) {
  const [f, setF] = useState(value);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  return (
    <div>
      <Field T={T} label="Customer / business name"><input className={inputCls(T)} value={f.name} onChange={set("name")} /></Field>
      <Field T={T} label="GSTIN (optional)"><input className={inputCls(T)} value={f.gstin} onChange={set("gstin")} /></Field>
      <Field T={T} label="Phone"><input className={inputCls(T)} value={f.phone} onChange={set("phone")} /></Field>
      <Field T={T} label="Address"><input className={inputCls(T)} value={f.address} onChange={set("address")} /></Field>
      <Field T={T} label="State">
        <select className={inputCls(T)} value={f.state} onChange={set("state")}>
          {INDIAN_STATES.map((s) => <option key={s} value={s}>{stateWithCode(s)}</option>)}
        </select>
      </Field>
      <button onClick={() => f.name && onSave(f)} className="w-full mt-2 flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-400 text-indigo-950 font-semibold text-sm py-2.5 rounded-lg">
        <Save size={15} /> Save customer
      </button>
    </div>
  );
}

function InvoiceList({ T, data, setEditingInvoiceDraft, setView, setData, setSelectedInvoiceId }) {
  const [query, setQuery] = useState("");
  const list = [...data.invoices].sort((a, b) => (a.date < b.date ? 1 : -1)).filter((i) => i.number.toLowerCase().includes(query.toLowerCase()) || i.customerName.toLowerCase().includes(query.toLowerCase()));
  const toggleStatus = (id) => setData((d) => ({ ...d, invoices: d.invoices.map((i) => (i.id === id ? { ...i, status: i.status === "paid" ? "pending" : "paid" } : i)) }));
  const editInvoice = (inv) => { setEditingInvoiceDraft(inv); setView("newInvoice"); };

  return (
    <div>
      <div className="flex items-center justify-between mb-4 gap-3">
        <h1 className="font-display text-2xl">Invoices</h1>
        <button onClick={() => { setEditingInvoiceDraft(null); setView("newInvoice"); }} className="flex items-center gap-2 bg-indigo-950 text-white text-sm px-3 py-2 rounded-lg hover:bg-indigo-900"><Plus size={15} /> New invoice</button>
      </div>
      <div className="relative mb-4 max-w-sm">
        <Search size={15} className={`absolute left-3 top-2.5 ${T.sub}`} />
        <input className={inputCls(T) + " pl-9"} placeholder="Search invoice number or customer" value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>

      {/* Desktop / tablet table */}
      <div className={`hidden md:block ${T.card} border ${T.border} rounded-xl overflow-x-auto`}>
        <table className="w-full text-sm">
          <thead>
            <tr className={`text-left ${T.sub} border-b ${T.border}`}>
              <th className="px-4 py-2.5 font-medium">Invoice</th>
              <th className="px-4 py-2.5 font-medium">Customer</th>
              <th className="px-4 py-2.5 font-medium">Date</th>
              <th className="px-4 py-2.5 font-medium">Type</th>
              <th className="px-4 py-2.5 font-medium text-right">Amount</th>
              <th className="px-4 py-2.5 font-medium">Status</th>
              <th className="px-4 py-2.5 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {list.map((inv) => (
              <tr key={inv.id} className={`border-b ${T.border} last:border-0 ${T.hover} cursor-pointer`} onClick={() => { setSelectedInvoiceId(inv.id); setView("invoiceDetail"); }}>
                <td className="px-4 py-2.5 font-medium">{inv.number}</td>
                <td className="px-4 py-2.5">{inv.customerName}</td>
                <td className="px-4 py-2.5">{inv.date}</td>
                <td className="px-4 py-2.5">{inv.docType}</td>
                <td className="px-4 py-2.5 text-right font-semibold">{inr(inv.totals.grandTotal)}</td>
                <td className="px-4 py-2.5">
                  <button onClick={(e) => { e.stopPropagation(); toggleStatus(inv.id); }} className={`text-xs px-2 py-1 rounded flex items-center gap-1 ${inv.status === "paid" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                    {inv.status === "paid" ? <CheckCircle2 size={12} /> : <Clock size={12} />} {inv.status}
                  </button>
                </td>
                <td className="px-4 py-2.5">
                  <div className="flex items-center justify-end gap-3">
                    <button onClick={(e) => { e.stopPropagation(); editInvoice(inv); }} title="Edit invoice"><Edit2 size={15} className={`${T.sub} hover:text-indigo-600`} /></button>
                    <ChevronRight size={15} className={T.sub} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {list.length === 0 && <p className={`text-sm ${T.sub} text-center py-10`}>No invoices yet.</p>}
      </div>

      {/* Mobile card list */}
      <div className="md:hidden space-y-2">
        {list.map((inv) => (
          <div key={inv.id} className={`${T.card} border ${T.border} rounded-xl p-3`}>
            <div className="flex items-start justify-between" onClick={() => { setSelectedInvoiceId(inv.id); setView("invoiceDetail"); }}>
              <div>
                <p className="text-sm font-medium">{inv.number}</p>
                <p className={`text-xs ${T.sub}`}>{inv.customerName} · {inv.date}</p>
                <p className={`text-xs ${T.sub}`}>{inv.docType}</p>
              </div>
              <p className="text-sm font-semibold">{inr(inv.totals.grandTotal)}</p>
            </div>
            <div className="flex items-center justify-between mt-2">
              <button onClick={() => toggleStatus(inv.id)} className={`text-xs px-2 py-1 rounded flex items-center gap-1 ${inv.status === "paid" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                {inv.status === "paid" ? <CheckCircle2 size={12} /> : <Clock size={12} />} {inv.status}
              </button>
              <div className="flex items-center gap-3">
                <button onClick={() => { setSelectedInvoiceId(inv.id); setView("invoiceDetail"); }} className={`text-xs ${T.accent} font-medium`}>View</button>
                <button onClick={() => editInvoice(inv)} className={`flex items-center gap-1 text-xs ${T.sub} font-medium`}><Edit2 size={13} /> Edit</button>
              </div>
            </div>
          </div>
        ))}
        {list.length === 0 && <p className={`text-sm ${T.sub} text-center py-10`}>No invoices yet.</p>}
      </div>
    </div>
  );
}

// Convert number to Indian words
function numToWords(n) {
  const ones = ["","One","Two","Three","Four","Five","Six","Seven","Eight","Nine","Ten","Eleven","Twelve","Thirteen","Fourteen","Fifteen","Sixteen","Seventeen","Eighteen","Nineteen"];
  const tens = ["","","Twenty","Thirty","Forty","Fifty","Sixty","Seventy","Eighty","Ninety"];
  if (n === 0) return "Zero";
  const convert = (num) => {
    if (num < 20) return ones[num];
    if (num < 100) return tens[Math.floor(num/10)] + (num%10 ? " " + ones[num%10] : "");
    if (num < 1000) return ones[Math.floor(num/100)] + " Hundred" + (num%100 ? " " + convert(num%100) : "");
    if (num < 100000) return convert(Math.floor(num/1000)) + " Thousand" + (num%1000 ? " " + convert(num%1000) : "");
    if (num < 10000000) return convert(Math.floor(num/100000)) + " Lakh" + (num%100000 ? " " + convert(num%100000) : "");
    return convert(Math.floor(num/10000000)) + " Crore" + (num%10000000 ? " " + convert(num%10000000) : "");
  };
  const rupees = Math.floor(n);
  const paise = Math.round((n - rupees) * 100);
  let words = "INR " + convert(rupees);
  if (paise > 0) words += " And " + convert(paise) + " Paise";
  return words + " Only";
}

const InvoicePaper = React.forwardRef(function InvoicePaper({ business, customer, docType, number, date, totals, consigneeName, consigneeAddress, consigneeGstin, consigneeState, buyerName, buyerAddress, buyerGstin, buyerState, paymentMethod, dispatchedThrough, vehicleNo, destination }, ref) {

  // Format date as DD/MM/YYYY
  const formatDate = (d) => {
    if (!d) return "—";
    const parts = d.split("-");
    if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
    return d;
  };

  // Build GST rate buckets for the summary table at bottom
  const hsnBuckets = {};
  (totals.lines || []).forEach((l) => {
    const key = l.hsn || "-";
    if (!hsnBuckets[key]) hsnBuckets[key] = { hsn: key, taxable: 0, gst: l.gst, cgst: 0, sgst: 0, igst: 0 };
    hsnBuckets[key].taxable += l.lineTaxable;
    hsnBuckets[key].cgst += l.cgst;
    hsnBuckets[key].sgst += l.sgst;
    hsnBuckets[key].igst += l.igst;
  });
  const hsnRows = Object.values(hsnBuckets);

  const box = (label, value, style = {}, attrs = {}) => {
    return (
      <td style={{ border: "1px solid black", padding: "4px 8px", verticalAlign: "top", ...style }} {...attrs}>
        <div style={{ fontSize: "10px", color: "#555" }}>{label}</div>
        <div style={{ fontWeight: "600", marginTop: 1 }}>{value || "—"}</div>
      </td>
    );
  };

  return (
    <div ref={ref} style={{ fontFamily: "Arial, sans-serif", fontSize: "11px", color: "#000", background: "#fff", padding: "10px", minWidth: 600 }}>

      {/* ── Title ── */}
      <div style={{ textAlign: "center", fontWeight: "bold", fontSize: "13px", marginBottom: 0, border: "1px solid black", borderBottom: "none", padding: "4px" }}>
        {docType}
      </div>

      {/* ── Seller + Invoice info (6 right-side boxes) ── */}
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <tbody>
          {/* Row 1: Seller (rowspan 4) | Invoice No | Dated */}
          <tr>
            <td rowSpan={4} style={{ border: "1px solid black", padding: "6px 8px", width: "52%", verticalAlign: "top" }}>
              <div style={{ fontSize: "17px", fontWeight: "900", marginBottom: 2 }}>{business.name}</div>
              <div>{business.address}</div>
              {business.phone && <div>Ph: {business.phone}</div>}
              <div style={{ marginTop: 4 }}>GSTIN/UIN: <strong>{business.gstin}</strong></div>
              <div>State Name: {stateWithCode(business.state)}</div>
              {business.email && <div>Email Id: {business.email}</div>}
            </td>
            {box("Invoice No.", number, { width: "24%" })}
            {box("Dated", formatDate(date), { width: "24%" })}
          </tr>
          {/* Row 2: Mode/Terms of Payment (full width right) */}
          <tr>
            {box("Mode/Terms of Payment", paymentMethod, {}, { colSpan: 2 })}
          </tr>
          {/* Row 3: Dispatched Through | Destination */}
          <tr>
            {box("Dispatched Through", dispatchedThrough)}
            {box("Destination", destination)}
          </tr>
          {/* Row 4: Vehicle Number (full width right) */}
          <tr>
            {box("Motor Vehicle No.", vehicleNo, {}, { colSpan: 2 })}
          </tr>
        </tbody>
      </table>

      {/* ── Consignee + Buyer — fully independent boxes ── */}
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <tbody>
          <tr>
            {/* Consignee box */}
            <td style={{ border: "1px solid black", padding: "6px 8px", width: "50%", verticalAlign: "top" }}>
              <div style={{ fontSize: "10px", color: "#555", marginBottom: 2 }}>Consignee (Ship to)</div>
              {consigneeName ? (
                <>
                  <div style={{ fontWeight: "bold" }}>{consigneeName}</div>
                  {consigneeAddress && <div style={{ marginTop: 2 }}>{consigneeAddress}</div>}
                  {consigneeState && <div>State Name: {stateWithCode(consigneeState)}</div>}
                  {consigneeGstin && <div>GSTIN: <strong>{consigneeGstin}</strong></div>}
                </>
              ) : (
                <div style={{ color: "#999", fontStyle: "italic", marginTop: 2 }}>Not specified</div>
              )}
            </td>
            {/* Buyer box */}
            <td style={{ border: "1px solid black", padding: "6px 8px", width: "50%", verticalAlign: "top" }}>
              <div style={{ fontSize: "10px", color: "#555", marginBottom: 2 }}>Buyer (Bill to)</div>
              {(buyerName || customer?.name) ? (
                <>
                  <div style={{ fontWeight: "bold" }}>{buyerName || customer?.name}</div>
                  {(buyerAddress || customer?.address) && <div style={{ marginTop: 2 }}>{buyerAddress || customer?.address}</div>}
                  {(buyerState || customer?.state) && <div>State Name: {stateWithCode(buyerState || customer?.state)}</div>}
                  {(buyerGstin || customer?.gstin) && <div>GSTIN: <strong>{buyerGstin || customer?.gstin}</strong></div>}
                </>
              ) : (
                <div style={{ color: "#999", fontStyle: "italic", marginTop: 2 }}>Not specified</div>
              )}
            </td>
          </tr>
        </tbody>
      </table>

      {/* ── Line items table ── */}
      <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 0 }}>
        <thead>
          <tr style={{ background: "#f5f5f5" }}>
            <th style={{ border: "1px solid black", padding: "4px 6px", textAlign: "center", width: "5%" }}>Sr.</th>
            <th style={{ border: "1px solid black", padding: "4px 6px", textAlign: "left" }}>Description of Goods</th>
            <th style={{ border: "1px solid black", padding: "4px 6px", textAlign: "center", width: "10%" }}>HSN/SAC</th>
            <th style={{ border: "1px solid black", padding: "4px 6px", textAlign: "center", width: "8%" }}>Qty</th>
            <th style={{ border: "1px solid black", padding: "4px 6px", textAlign: "right", width: "12%" }}>Rate (₹)</th>
            <th style={{ border: "1px solid black", padding: "4px 6px", textAlign: "right", width: "14%" }}>Amount (₹)</th>
          </tr>
        </thead>
        <tbody>
          {(totals.lines || []).map((l, i) => (
            <tr key={i}>
              <td style={{ border: "1px solid black", padding: "4px 6px", textAlign: "center" }}>{i + 1}</td>
              <td style={{ border: "1px solid black", padding: "4px 6px" }}>{l.name}
                {l.discountPercent > 0 && <span style={{ color: "#888", fontSize: "10px" }}> (Disc: {l.discountPercent}%)</span>}
              </td>
              <td style={{ border: "1px solid black", padding: "4px 6px", textAlign: "center" }}>{l.hsn || "—"}</td>
              <td style={{ border: "1px solid black", padding: "4px 6px", textAlign: "center" }}>{l.qty}</td>
              <td style={{ border: "1px solid black", padding: "4px 6px", textAlign: "right" }}>{inr(l.rate)}</td>
              <td style={{ border: "1px solid black", padding: "4px 6px", textAlign: "right" }}>{inr(l.lineTaxable)}</td>
            </tr>
          ))}
          {/* Empty rows to fill space */}
          {Array.from({ length: Math.max(0, 5 - (totals.lines || []).length) }).map((_, i) => (
            <tr key={"empty-" + i} style={{ height: 22 }}>
              <td style={{ border: "1px solid black" }}></td>
              <td style={{ border: "1px solid black" }}></td>
              <td style={{ border: "1px solid black" }}></td>
              <td style={{ border: "1px solid black" }}></td>
              <td style={{ border: "1px solid black" }}></td>
              <td style={{ border: "1px solid black" }}></td>
            </tr>
          ))}
          {/* TOTAL row */}
          <tr style={{ fontWeight: "bold", background: "#fafafa" }}>
            <td colSpan={3} style={{ border: "1px solid black", padding: "4px 6px", textAlign: "center" }}>TOTAL</td>
            <td style={{ border: "1px solid black", padding: "4px 6px", textAlign: "center" }}>
              {(totals.lines || []).reduce((s, l) => s + l.qty, 0)}
            </td>
            <td style={{ border: "1px solid black", padding: "4px 6px" }}></td>
            <td style={{ border: "1px solid black", padding: "4px 6px", textAlign: "right" }}>{inr(totals.taxable)}</td>
          </tr>
        </tbody>
      </table>

      {/* ── Tax summary ── */}
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <tbody>
          {totals.sameState ? (
            <>
              <tr>
                <td colSpan={4} style={{ border: "1px solid black", padding: "3px 8px", textAlign: "right", fontWeight: "bold" }}>CGST {hsnRows[0]?.gst/2 || 0}%</td>
                <td style={{ border: "1px solid black", padding: "3px 8px", textAlign: "right", width: "16%" }}>{inr(totals.cgst)}</td>
              </tr>
              <tr>
                <td colSpan={4} style={{ border: "1px solid black", padding: "3px 8px", textAlign: "right", fontWeight: "bold" }}>SGST {hsnRows[0]?.gst/2 || 0}%</td>
                <td style={{ border: "1px solid black", padding: "3px 8px", textAlign: "right" }}>{inr(totals.sgst)}</td>
              </tr>
            </>
          ) : (
            <tr>
              <td colSpan={4} style={{ border: "1px solid black", padding: "3px 8px", textAlign: "right", fontWeight: "bold" }}>IGST</td>
              <td style={{ border: "1px solid black", padding: "3px 8px", textAlign: "right", width: "16%" }}>{inr(totals.igst)}</td>
            </tr>
          )}
          {totals.roundOffAmt !== 0 && (
            <tr>
              <td colSpan={4} style={{ border: "1px solid black", padding: "3px 8px", textAlign: "right" }}>Round Off</td>
              <td style={{ border: "1px solid black", padding: "3px 8px", textAlign: "right" }}>{inr(totals.roundOffAmt)}</td>
            </tr>
          )}
          <tr style={{ fontWeight: "bold", fontSize: "12px" }}>
            <td colSpan={4} style={{ border: "1px solid black", padding: "4px 8px", textAlign: "center" }}>GRAND TOTAL</td>
            <td style={{ border: "1px solid black", padding: "4px 8px", textAlign: "right" }}>{inr(totals.grandTotal)}</td>
          </tr>
        </tbody>
      </table>

      {/* ── Amount in words ── */}
      <div style={{ border: "1px solid black", borderTop: "none", padding: "4px 8px" }}>
        <span style={{ fontSize: "10px", color: "#555" }}>Amount in Words: </span>
        <strong>{numToWords(totals.grandTotal)}</strong>
      </div>

      {/* ── HSN summary + Bank details + Signature ── */}
      <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 0 }}>
        <tbody>
          <tr>
            {/* Bank details */}
            <td style={{ border: "1px solid black", padding: "6px 8px", width: "45%", verticalAlign: "top", borderTop: "none" }}>
              {(business.bankName || business.accountNo) ? (
                <>
                  <div style={{ fontWeight: "bold", marginBottom: 3 }}>Bank Details:</div>
                  {business.bankName && <div>Bank Name &nbsp;&nbsp;: {business.bankName}</div>}
                  {business.accountName && <div>Account Name: {business.accountName}</div>}
                  {business.accountNo && <div>A/c No &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;: {business.accountNo}</div>}
                  {business.ifsc && <div>IFSC &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;: {business.ifsc}</div>}
                </>
              ) : (
                <div style={{ color: "#aaa", fontSize: "10px" }}>Add bank details in Settings</div>
              )}
            </td>
            {/* HSN summary table */}
            <td style={{ border: "1px solid black", padding: 0, width: "55%", verticalAlign: "top", borderTop: "none" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "10px" }}>
                <thead>
                  <tr style={{ background: "#f5f5f5" }}>
                    <th style={{ border: "1px solid black", padding: "3px 4px" }}>HSN</th>
                    <th style={{ border: "1px solid black", padding: "3px 4px", textAlign: "right" }}>Taxable</th>
                    {totals.sameState ? (
                      <>
                        <th style={{ border: "1px solid black", padding: "3px 4px", textAlign: "right" }}>CGST</th>
                        <th style={{ border: "1px solid black", padding: "3px 4px", textAlign: "right" }}>SGST</th>
                      </>
                    ) : (
                      <th style={{ border: "1px solid black", padding: "3px 4px", textAlign: "right" }}>IGST</th>
                    )}
                    <th style={{ border: "1px solid black", padding: "3px 4px", textAlign: "right" }}>Total Tax</th>
                  </tr>
                </thead>
                <tbody>
                  {hsnRows.map((r, i) => (
                    <tr key={i}>
                      <td style={{ border: "1px solid black", padding: "3px 4px" }}>{r.hsn}</td>
                      <td style={{ border: "1px solid black", padding: "3px 4px", textAlign: "right" }}>{inr(r.taxable)}</td>
                      {totals.sameState ? (
                        <>
                          <td style={{ border: "1px solid black", padding: "3px 4px", textAlign: "right" }}>{inr(r.cgst)}</td>
                          <td style={{ border: "1px solid black", padding: "3px 4px", textAlign: "right" }}>{inr(r.sgst)}</td>
                        </>
                      ) : (
                        <td style={{ border: "1px solid black", padding: "3px 4px", textAlign: "right" }}>{inr(r.igst)}</td>
                      )}
                      <td style={{ border: "1px solid black", padding: "3px 4px", textAlign: "right" }}>{inr(r.cgst + r.sgst + r.igst)}</td>
                    </tr>
                  ))}
                  <tr style={{ fontWeight: "bold", background: "#fafafa" }}>
                    <td style={{ border: "1px solid black", padding: "3px 4px" }}>Total</td>
                    <td style={{ border: "1px solid black", padding: "3px 4px", textAlign: "right" }}>{inr(totals.taxable)}</td>
                    {totals.sameState ? (
                      <>
                        <td style={{ border: "1px solid black", padding: "3px 4px", textAlign: "right" }}>{inr(totals.cgst)}</td>
                        <td style={{ border: "1px solid black", padding: "3px 4px", textAlign: "right" }}>{inr(totals.sgst)}</td>
                      </>
                    ) : (
                      <td style={{ border: "1px solid black", padding: "3px 4px", textAlign: "right" }}>{inr(totals.igst)}</td>
                    )}
                    <td style={{ border: "1px solid black", padding: "3px 4px", textAlign: "right" }}>{inr(totals.cgst + totals.sgst + totals.igst)}</td>
                  </tr>
                </tbody>
              </table>
            </td>
          </tr>
          {/* Declaration + Signature */}
          <tr>
            <td style={{ border: "1px solid black", padding: "6px 8px", borderTop: "none", verticalAlign: "top" }}>
              <div style={{ fontWeight: "bold", marginBottom: 2 }}>Declaration</div>
              <div style={{ fontSize: "10px", color: "#333" }}>{business.declaration || "We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct."}</div>
            </td>
            <td style={{ border: "1px solid black", padding: "6px 8px", borderTop: "none", textAlign: "right", verticalAlign: "bottom" }}>
              <div style={{ fontSize: "10px", color: "#555", marginBottom: 24 }}>For {business.name}</div>
              <div style={{ fontSize: "10px", borderTop: "1px solid #333", paddingTop: 4, textAlign: "center" }}>Authorised Signatory</div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
});

function InvoiceDetail({ T, data, setData, invoiceId, setView, setEditingInvoiceDraft }) {
  const invoice = data.invoices.find((i) => i.id === invoiceId);
  const nodeRef = React.useRef(null);
  const [busy, setBusy] = useState(null); // "download" | "share" | null
  const [error, setError] = useState("");
  const [shareInfo, setShareInfo] = useState("");

  if (!invoice) {
    return (
      <div>
        <button onClick={() => setView("invoices")} className={`flex items-center gap-2 text-sm mb-4 ${T.sub}`}><ArrowLeft size={16} /> Back to invoices</button>
        <p className={`text-sm ${T.sub}`}>Invoice not found.</p>
      </div>
    );
  }

  const filename = `${invoice.number}.pdf`;

  const handleDownload = async () => {
    setError(""); setShareInfo(""); setBusy("download");
    try {
      const blob = await nodeToPdfBlob(nodeRef.current);
      downloadBlob(blob, filename);
    } catch (e) {
      setError("Couldn't generate the PDF. Check your internet connection and try again.");
    } finally {
      setBusy(null);
    }
  };

  const handleShare = async () => {
    setError(""); setShareInfo(""); setBusy("share");
    try {
      const blob = await nodeToPdfBlob(nodeRef.current);
      const result = await sharePdfBlob(blob, filename);
      setShareInfo(result === "shared" ? "Shared." : "Your browser doesn't support direct sharing here, so the PDF was downloaded instead — attach it from your downloads to WhatsApp, email, etc.");
    } catch (e) {
      if (e && e.name !== "AbortError") setError("Couldn't share the PDF. Check your internet connection and try again.");
    } finally {
      setBusy(null);
    }
  };

  const handlePrint = () => {
    const w = window.open("", "_blank");
    w.document.write(`<html><head><title>${filename}</title></head><body>${nodeRef.current.outerHTML}</body></html>`);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 300);
  };

  const customer = data.customers.find((c) => c.id === invoice.customerId);
  const handleEdit = () => { setEditingInvoiceDraft(invoice); setView("newInvoice"); };

  return (
    <div>
      <button onClick={() => setView("invoices")} className={`flex items-center gap-2 text-sm mb-4 ${T.sub}`}><ArrowLeft size={16} /> Back to invoices</button>
      <div className="grid lg:grid-cols-5 gap-5">
        <div className="lg:col-span-2 lg:col-start-2">
          <InvoicePaper ref={nodeRef} business={data.business} customer={customer} docType={invoice.docType} number={invoice.number} date={invoice.date} totals={invoice.totals} consigneeName={invoice.consigneeName} consigneeAddress={invoice.consigneeAddress} consigneeGstin={invoice.consigneeGstin} consigneeState={invoice.consigneeState} buyerName={invoice.buyerName} buyerAddress={invoice.buyerAddress} buyerGstin={invoice.buyerGstin} buyerState={invoice.buyerState} paymentMethod={invoice.paymentMethod} dispatchedThrough={invoice.dispatchedThrough} vehicleNo={invoice.vehicleNo} destination={invoice.destination} />
          {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
          {shareInfo && <p className="text-xs text-emerald-600 mt-2">{shareInfo}</p>}
          <div className="grid grid-cols-3 gap-2 mt-4">
            <button onClick={handleDownload} disabled={busy !== null} className="flex items-center justify-center gap-1.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-indigo-950 font-semibold text-xs py-2.5 rounded-lg">
              {busy === "download" ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />} PDF
            </button>
            <button onClick={handleShare} disabled={busy !== null} className="flex items-center justify-center gap-1.5 bg-indigo-950 hover:bg-indigo-900 disabled:opacity-50 text-white font-semibold text-xs py-2.5 rounded-lg">
              {busy === "share" ? <Loader2 size={14} className="animate-spin" /> : <Share2 size={14} />} Share
            </button>
            <button onClick={handlePrint} className={`flex items-center justify-center gap-1.5 border ${T.border} font-semibold text-xs py-2.5 rounded-lg ${T.hover}`}>
              <Printer size={14} /> Print
            </button>
          </div>
          <div className="mt-2">
            <button onClick={handleEdit} className={`w-full flex items-center justify-center gap-1.5 border ${T.border} font-semibold text-xs py-2.5 rounded-lg ${T.hover}`}>
              <Edit2 size={14} /> Edit invoice
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function NewInvoice({ T, data, setData, setView, draft, setSelectedInvoiceId }) {
  const [customerId, setCustomerId] = useState(draft?.customerId || data.customers[0]?.id || "");
  const [docType, setDocType] = useState(draft?.docType || "Tax Invoice");
  const [date, setDate] = useState(draft?.date || todayISO());
  const [paymentMethod, setPaymentMethod] = useState(draft?.paymentMethod || "Cash");
  const [status, setStatus] = useState(draft?.status || "paid");
  const [roundOff, setRoundOff] = useState(draft?.roundOff ?? true);
  const [consigneeName, setConsigneeName] = useState(draft?.consigneeName || "");
  const [consigneeAddress, setConsigneeAddress] = useState(draft?.consigneeAddress || "");
  const [consigneeGstin, setConsigneeGstin] = useState(draft?.consigneeGstin || "");
  const [consigneeState, setConsigneeState] = useState(draft?.consigneeState || "");
  const [buyerName, setBuyerName] = useState(draft?.buyerName || "");
  const [buyerAddress, setBuyerAddress] = useState(draft?.buyerAddress || "");
  const [buyerGstin, setBuyerGstin] = useState(draft?.buyerGstin || "");
  const [buyerState, setBuyerState] = useState(draft?.buyerState || "");
  const [dispatchedThrough, setDispatchedThrough] = useState(draft?.dispatchedThrough || "");
  const [vehicleNo, setVehicleNo] = useState(draft?.vehicleNo || "");
  const [destination, setDestination] = useState(draft?.destination || "");
  const [items, setItems] = useState(draft?.items || []);
  const [productQuery, setProductQuery] = useState("");
  const [saved, setSaved] = useState(false);
  const isEditing = Boolean(draft?.id);

  const customer = data.customers.find((c) => c.id === customerId);
  const matchingProducts = productQuery ? data.products.filter((p) => p.name.toLowerCase().includes(productQuery.toLowerCase())).slice(0, 6) : [];

  const addProduct = (p) => {
    setItems((prev) => {
      const existing = prev.find((i) => i.productId === p.id);
      if (existing) return prev.map((i) => (i.productId === p.id ? { ...i, qty: i.qty + 1 } : i));
      return [...prev, { productId: p.id, name: p.name, hsn: p.hsn, qty: 1, rate: p.sellingPrice, gst: p.gst, discountPercent: 0 }];
    });
    setProductQuery("");
  };
  const updateItem = (idx, patch) => setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  const removeItem = (idx) => setItems((prev) => prev.filter((_, i) => i !== idx));

  const totals = useMemo(() => computeInvoice(items, data.business.state, customer?.state || data.business.state, roundOff), [items, customer, data.business.state, roundOff]);
  const invoiceNumber = isEditing ? draft.number : makeInvoiceNumber(data.business.invoicePrefix, data.invoiceSeq, date);

  const saveInvoice = () => {
    if ((!customer && !buyerName) || items.length === 0) return;
    const targetId = isEditing ? draft.id : uid();
    setData((d) => {
      // Restore stock from the invoice's previous items (if editing) before
      // applying the new items, so stock levels stay accurate either way.
      let products = d.products;
      if (isEditing) {
        products = products.map((p) => {
          const used = draft.items.find((i) => i.productId === p.id);
          return used ? { ...p, stock: p.stock + used.qty } : p;
        });
      }
      products = products.map((p) => {
        const used = items.find((i) => i.productId === p.id);
        return used ? { ...p, stock: Math.max(0, p.stock - used.qty) } : p;
      });

      const custId = customer ? customer.id : null;
      const custName = customer ? customer.name : (buyerName || "Walk-in Customer");
      if (isEditing) {
        const invoices = d.invoices.map((i) =>
          i.id === targetId
            ? { ...i, date, docType, customerId: custId, customerName: custName, paymentMethod, status, items, totals, roundOff, consigneeName, consigneeAddress, consigneeGstin, consigneeState, buyerName, buyerAddress, buyerGstin, buyerState, dispatchedThrough, vehicleNo, destination }
            : i
        );
        return { ...d, invoices, products };
      }

      const number = makeInvoiceNumber(d.business.invoicePrefix, d.invoiceSeq, date);
      const invoice = { id: targetId, number, date, docType, customerId: custId, customerName: custName, paymentMethod, status, items, totals, roundOff, consigneeName, consigneeAddress, consigneeGstin, consigneeState, buyerName, buyerAddress, buyerGstin, buyerState, dispatchedThrough, vehicleNo, destination };
      return { ...d, invoices: [...d.invoices, invoice], invoiceSeq: d.invoiceSeq + 1, products };
    });
    setSaved(true);
    setSelectedInvoiceId(targetId);
    setTimeout(() => setView("invoiceDetail"), 500);
  };

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <button onClick={() => setView("invoices")} className={T.sub}><ArrowLeft size={18} /></button>
        <h1 className="font-display text-2xl">{isEditing ? "Edit invoice" : "New invoice"}</h1>
      </div>

      <div className="grid lg:grid-cols-5 gap-5">
        {/* Form */}
        <div className="lg:col-span-3 space-y-4">
          <div className={`${T.card} border ${T.border} rounded-xl p-4`}>
            <div className="grid sm:grid-cols-2 gap-3">
              <Field T={T} label="Saved customer (optional)">
                <select className={inputCls(T)} value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
                  <option value="">— Walk-in / No saved customer —</option>
                  {data.customers.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.state})</option>)}
                </select>
              </Field>
              <Field T={T} label="Document type">
                <select className={inputCls(T)} value={docType} onChange={(e) => setDocType(e.target.value)}>
                  {["Tax Invoice", "Retail Invoice", "Quotation", "Proforma Invoice", "Credit Note", "Debit Note"].map((t) => <option key={t}>{t}</option>)}
                </select>
              </Field>
              <Field T={T} label="Date"><input type="date" className={inputCls(T)} value={date} onChange={(e) => setDate(e.target.value)} /></Field>
              <Field T={T} label="Payment method">
                <select className={inputCls(T)} value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
                  {["Cash", "UPI", "Credit Card", "Debit Card", "Bank Transfer", "Wallet"].map((m) => <option key={m}>{m}</option>)}
                </select>
              </Field>
            </div>
            <div className="flex items-center gap-4 mt-1">
              <label className="flex items-center gap-2 text-sm"><input type="radio" checked={status === "paid"} onChange={() => setStatus("paid")} /> Paid</label>
              <label className="flex items-center gap-2 text-sm"><input type="radio" checked={status === "pending"} onChange={() => setStatus("pending")} /> Pending</label>
              <label className="flex items-center gap-2 text-sm ml-auto"><input type="checkbox" checked={roundOff} onChange={(e) => setRoundOff(e.target.checked)} /> Round off total</label>
            </div>
            <div className={`border-t ${T.border} mt-3 pt-3`}>
              {/* ── Consignee ── */}
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold">Consignee / Ship to</p>
                <span className={`text-[11px] ${T.sub}`}>Not saved to customer list</span>
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                <Field T={T} label="Consignee name"><input className={inputCls(T)} value={consigneeName} onChange={(e) => setConsigneeName(e.target.value)} placeholder="Name (optional)" /></Field>
                <Field T={T} label="GSTIN (leave blank if no GST)"><input className={inputCls(T)} value={consigneeGstin} onChange={(e) => setConsigneeGstin(e.target.value)} placeholder="GSTIN or blank" /></Field>
                <Field T={T} label="Address"><input className={inputCls(T)} value={consigneeAddress} onChange={(e) => setConsigneeAddress(e.target.value)} placeholder="Full address" /></Field>
                <Field T={T} label="State">
                  <select className={inputCls(T)} value={consigneeState} onChange={(e) => setConsigneeState(e.target.value)}>
                    <option value="">— Select state —</option>
                    {INDIAN_STATES.map((s) => <option key={s} value={s}>{stateWithCode(s)}</option>)}
                  </select>
                </Field>
              </div>
            </div>

            <div className={`border-t ${T.border} mt-3 pt-3`}>
              {/* ── Buyer ── */}
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold">Buyer / Bill to</p>
                <div className="flex items-center gap-2">
                  {customer && (
                    <button type="button"
                      onClick={() => { setBuyerName(customer.name); setBuyerAddress(customer.address || ""); setBuyerGstin(customer.gstin || ""); setBuyerState(customer.state || ""); }}
                      className="text-xs text-amber-600 font-medium underline">
                      Fill from saved customer
                    </button>
                  )}
                  <button type="button"
                    onClick={() => { setBuyerName(""); setBuyerAddress(""); setBuyerGstin(""); setBuyerState(""); }}
                    className={`text-xs ${T.sub} underline`}>
                    Clear
                  </button>
                </div>
              </div>

              {/* Walk-in / no-GST notice */}
              <div className={`mb-3 rounded-lg px-3 py-2 text-xs flex items-center gap-2 bg-amber-50 border border-amber-200 text-amber-800`}>
                <span>💡</span>
                <span>For <strong>walk-in / no-GST customers</strong> — just type name &amp; address below. Leave GSTIN blank. Nothing is saved to the customer list.</span>
              </div>

              <div className="grid sm:grid-cols-2 gap-3">
                <Field T={T} label="Buyer name"><input className={inputCls(T)} value={buyerName} onChange={(e) => setBuyerName(e.target.value)} placeholder="Name or firm" /></Field>
                <Field T={T} label="GSTIN (leave blank if no GST)"><input className={inputCls(T)} value={buyerGstin} onChange={(e) => setBuyerGstin(e.target.value)} placeholder="GSTIN or blank" /></Field>
                <Field T={T} label="Address"><input className={inputCls(T)} value={buyerAddress} onChange={(e) => setBuyerAddress(e.target.value)} placeholder="Full address" /></Field>
                <Field T={T} label="State">
                  <select className={inputCls(T)} value={buyerState} onChange={(e) => setBuyerState(e.target.value)}>
                    <option value="">— Select state —</option>
                    {INDIAN_STATES.map((s) => <option key={s} value={s}>{stateWithCode(s)}</option>)}
                  </select>
                </Field>
              </div>
            </div>
            <div className={`border-t ${T.border} mt-3 pt-3`}>
              <p className={`text-xs font-medium mb-2 ${T.sub}`}>Dispatch details (optional)</p>
              <div className="grid sm:grid-cols-3 gap-3">
                <Field T={T} label="Dispatched Through"><input className={inputCls(T)} value={dispatchedThrough} onChange={(e) => setDispatchedThrough(e.target.value)} placeholder="e.g. BY ROAD" /></Field>
                <Field T={T} label="Destination"><input className={inputCls(T)} value={destination} onChange={(e) => setDestination(e.target.value)} placeholder="e.g. Chennai" /></Field>
                <Field T={T} label="Vehicle Number"><input className={inputCls(T)} value={vehicleNo} onChange={(e) => setVehicleNo(e.target.value)} placeholder="e.g. TN24AX4299" /></Field>
              </div>
            </div>
          </div>

          <div className={`${T.card} border ${T.border} rounded-xl p-4`}>
            <p className="font-medium text-sm mb-2">Add products</p>
            <div className="relative">
              <Search size={15} className={`absolute left-3 top-2.5 ${T.sub}`} />
              <input className={inputCls(T) + " pl-9"} placeholder="Search product or scan barcode" value={productQuery} onChange={(e) => setProductQuery(e.target.value)} />
              {matchingProducts.length > 0 && (
                <div className={`absolute z-10 mt-1 w-full ${T.panel} border ${T.border} rounded-lg shadow-lg overflow-hidden`}>
                  {matchingProducts.map((p) => (
                    <button key={p.id} onClick={() => addProduct(p)} className={`w-full text-left px-3 py-2 text-sm flex items-center justify-between ${T.hover}`}>
                      <span>{p.name}</span><span className={T.sub}>{inr(p.sellingPrice)} · GST {p.gst}%</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Clean flat table - no boxes */}
            {items.length > 0 && (
              <div className="mt-3 overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className={`text-xs ${T.sub} border-b-2 ${T.border}`}>
                      <th className="text-left pb-2 font-semibold">Product</th>
                      <th className="text-center pb-2 font-semibold w-16">Qty</th>
                      <th className="text-right pb-2 font-semibold w-20">Rate ₹</th>
                      <th className="text-right pb-2 font-semibold w-16">Disc%</th>
                      <th className="text-right pb-2 font-semibold w-16">GST%</th>
                      <th className="text-right pb-2 font-semibold w-20">Amount</th>
                      <th className="w-6"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((it, idx) => {
                      const amt = it.qty * it.rate * (1 - (it.discountPercent || 0) / 100);
                      return (
                        <tr key={idx} className={`border-b ${T.border} last:border-0`}>
                          <td className="py-2 text-sm font-medium">{it.name}</td>
                          <td className="py-1 px-1 text-center">
                            <input type="number" min="1"
                              className={`w-14 text-center text-sm outline-none focus:ring-1 focus:ring-amber-500 rounded px-1 py-0.5 ${T.input} border ${T.border}`}
                              value={it.qty} onChange={(e) => updateItem(idx, { qty: Number(e.target.value) })} />
                          </td>
                          <td className="py-1 px-1 text-right">
                            <input type="number"
                              className={`w-20 text-right text-sm outline-none focus:ring-1 focus:ring-amber-500 rounded px-1 py-0.5 ${T.input} border ${T.border}`}
                              value={it.rate} onChange={(e) => updateItem(idx, { rate: Number(e.target.value) })} />
                          </td>
                          <td className="py-1 px-1 text-right">
                            <input type="number"
                              className={`w-14 text-right text-sm outline-none focus:ring-1 focus:ring-amber-500 rounded px-1 py-0.5 ${T.input} border ${T.border}`}
                              value={it.discountPercent} onChange={(e) => updateItem(idx, { discountPercent: Number(e.target.value) })} />
                          </td>
                          <td className="py-1 px-1 text-right">
                            <select
                              className={`w-16 text-sm outline-none focus:ring-1 focus:ring-amber-500 rounded px-1 py-0.5 ${T.input} border ${T.border}`}
                              value={it.gst} onChange={(e) => updateItem(idx, { gst: Number(e.target.value) })}>
                              {GST_RATES.map((r) => <option key={r} value={r}>{r}%</option>)}
                            </select>
                          </td>
                          <td className="py-2 text-sm text-right font-semibold">{inr(amt)}</td>
                          <td className="py-2 pl-2">
                            <button onClick={() => removeItem(idx)}><Trash2 size={13} className="text-red-400 hover:text-red-600" /></button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            {items.length === 0 && <p className={`text-sm ${T.sub} text-center py-6`}>Search above to add products to this invoice.</p>}
            </div>
          </div>
        </div>

        {/* Live preview */}
        <div className="lg:col-span-2">
          <div className="lg:sticky lg:top-4">
            <InvoicePaper business={data.business} customer={customer} docType={docType} number={invoiceNumber} date={date} totals={totals} consigneeName={consigneeName} consigneeAddress={consigneeAddress} consigneeGstin={consigneeGstin} consigneeState={consigneeState} buyerName={buyerName} buyerAddress={buyerAddress} buyerGstin={buyerGstin} buyerState={buyerState} paymentMethod={paymentMethod} dispatchedThrough={dispatchedThrough} vehicleNo={vehicleNo} destination={destination} />

            <button onClick={saveInvoice} disabled={(!customer && !buyerName) || items.length === 0}
              className="w-full mt-4 flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-indigo-950 font-semibold text-sm py-3 rounded-lg">
              {saved ? <><CheckCircle2 size={16} /> Saved — opening invoice…</> : <><Save size={16} /> {isEditing ? "Update invoice" : "Save invoice"}</>}
            </button>
            <p className={`text-xs ${T.sub} mt-2 text-center`}>You will be able to download a PDF or share it right after saving.</p>
          </div>
        </div>
      </div>
  );
}

function Reports({ T, data }) {
  const byMonth = {};
  data.invoices.forEach((inv) => { const m = inv.date.slice(0, 7); byMonth[m] = (byMonth[m] || 0) + inv.totals.grandTotal; });
  const chartData = Object.entries(byMonth).sort().map(([m, v]) => ({ month: m, sales: Math.round(v) }));
  const gstCollected = data.invoices.reduce((s, i) => s + i.totals.cgst + i.totals.sgst + i.totals.igst, 0);
  const totalDiscount = data.invoices.reduce((s, i) => s + i.totals.discountTotal, 0);

  return (
    <div>
      <h1 className="font-display text-2xl mb-4">Reports</h1>
      <div className="grid sm:grid-cols-3 gap-3 mb-5">
        <StatCard T={T} icon={IndianRupee} label="GST collected" value={inr(gstCollected)} />
        <StatCard T={T} icon={FileText} label="Invoices raised" value={data.invoices.length} />
        <StatCard T={T} icon={TrendingUp} label="Total discounts given" value={inr(totalDiscount)} />
      </div>
      <div className={`${T.card} border ${T.border} rounded-xl p-4`}>
        <p className="font-medium text-sm mb-3">Sales by month</p>
        {chartData.length === 0 ? (
          <p className={`text-sm ${T.sub} text-center py-10`}>Create invoices to see sales trends here.</p>
        ) : (
          <div style={{ width: "100%", height: 260 }}>
            <ResponsiveContainer>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke={T.border.includes("stone-800") ? "#292524" : "#e7e5e4"} />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip formatter={(v) => inr(v)} />
                <Bar dataKey="sales" fill="#d97706" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}

function UsersView({ T, data, setData, session }) {
  const [modal, setModal] = useState(null);
  const users = data.users || DEFAULT_USERS;

  const ROLE_COLORS = { owner: "bg-purple-100 text-purple-700", admin: "bg-blue-100 text-blue-700", manager: "bg-emerald-100 text-emerald-700", cashier: "bg-amber-100 text-amber-700" };

  const save = (u) => {
    setData((d) => {
      const exists = (d.users || []).some((x) => x.id === u.id);
      const users = exists ? (d.users || []).map((x) => (x.id === u.id ? u : x)) : [...(d.users || []), { ...u, id: uid() }];
      return { ...d, users };
    });
    setModal(null);
  };

  const toggleActive = (id) => {
    if (id === session.id) return; // can't deactivate yourself
    setData((d) => ({ ...d, users: (d.users || []).map((u) => u.id === id ? { ...u, active: !u.active } : u) }));
  };

  const remove = (id) => {
    if (id === session.id) return;
    setData((d) => ({ ...d, users: (d.users || []).filter((u) => u.id !== id) }));
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="font-display text-2xl">Users</h1>
          <p className={`text-xs ${T.sub}`}>Manage login accounts and roles</p>
        </div>
        <button onClick={() => setModal({ name: "", userId: "", password: "", role: "cashier", active: true })}
          className="flex items-center gap-2 bg-indigo-950 text-white text-sm px-3 py-2 rounded-lg hover:bg-indigo-900"><Plus size={15} /> Add user</button>
      </div>

      {/* Role permissions legend */}
      <div className={`${T.card} border ${T.border} rounded-xl p-4 mb-4`}>
        <p className="text-xs font-medium mb-2 flex items-center gap-1.5"><Shield size={13} /> Role permissions</p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2 text-xs">
          {Object.entries(ROLE_ACCESS).map(([role, access]) => (
            <div key={role} className={`rounded-lg p-2 ${ROLE_COLORS[role]}`}>
              <p className="font-semibold capitalize mb-1">{role}</p>
              <p className="opacity-80 leading-relaxed">{access.filter(a => !["newInvoice","invoiceDetail"].includes(a)).join(", ")}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {users.map((u) => (
          <div key={u.id} className={`${T.card} border ${T.border} rounded-xl p-4 ${!u.active ? "opacity-60" : ""}`}>
            <div className="flex items-start justify-between mb-2">
              <div>
                <p className="font-medium text-sm">{u.name}</p>
                <p className={`text-xs ${T.sub}`}>@{u.userId}</p>
              </div>
              <div className="flex gap-2">
                {u.id !== session.id && <button onClick={() => setModal(u)}><Edit2 size={14} className={T.sub} /></button>}
                {u.id !== session.id && <button onClick={() => remove(u.id)}><Trash2 size={14} className="text-red-500" /></button>}
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ROLE_COLORS[u.role]}`}>{u.role}</span>
              <button onClick={() => toggleActive(u.id)} className={`text-xs px-2 py-0.5 rounded-full font-medium ${u.active ? "bg-emerald-100 text-emerald-700" : "bg-stone-100 text-stone-500"}`}>
                {u.active ? "Active" : "Inactive"}
              </button>
            </div>
            {u.id === session.id && <p className={`text-[11px] ${T.sub} mt-1`}>← You are logged in as this user</p>}
          </div>
        ))}
      </div>

      {modal && (
        <Modal T={T} title={modal.id ? "Edit user" : "Add user"} onClose={() => setModal(null)}>
          <UserForm T={T} value={modal} onSave={save} />
        </Modal>
      )}
    </div>
  );
}

function UserForm({ T, value, onSave }) {
  const [f, setF] = useState(value);
  const [showPw, setShowPw] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  return (
    <div>
      <Field T={T} label="Full name"><input className={inputCls(T)} value={f.name} onChange={set("name")} placeholder="e.g. Ramesh Kumar" /></Field>
      <Field T={T} label="User ID (for login)"><input className={inputCls(T)} value={f.userId} onChange={set("userId")} placeholder="e.g. ramesh" /></Field>
      <Field T={T} label="Password">
        <div className="relative">
          <input type={showPw ? "text" : "password"} className={inputCls(T) + " pr-9"} value={f.password} onChange={set("password")} placeholder="Min 6 characters" />
          <button type="button" onClick={() => setShowPw(s => !s)} className={`absolute right-3 top-2.5 ${T.sub}`}>
            {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
        </div>
      </Field>
      <Field T={T} label="Role">
        <select className={inputCls(T)} value={f.role} onChange={set("role")}>
          <option value="owner">Owner — full access</option>
          <option value="admin">Admin — no user management</option>
          <option value="manager">Manager — no settings</option>
          <option value="cashier">Cashier — billing only</option>
        </select>
      </Field>
      <label className="flex items-center gap-2 text-sm mb-4">
        <input type="checkbox" checked={f.active} onChange={(e) => setF({ ...f, active: e.target.checked })} />
        Account active (can log in)
      </label>
      <button onClick={() => f.name && f.userId && f.password && onSave(f)}
        className="w-full flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-400 text-indigo-950 font-semibold text-sm py-2.5 rounded-lg">
        <Save size={15} /> Save user
      </button>
    </div>
  );
}

function SettingsView({ T, data, setData }) {
  const [f, setF] = useState({ invoicePrefix: "INV", bankName: "", accountName: "", accountNo: "", ifsc: "", declaration: "", email: "", ...data.business });
  const [saved, setSaved] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const save = () => { setData((d) => ({ ...d, business: f })); setSaved(true); setTimeout(() => setSaved(false), 2000); };
  const previewNumber = makeInvoiceNumber(f.invoicePrefix || "INV", data.invoiceSeq, todayISO());
  return (
    <div className="max-w-lg">
      <h1 className="font-display text-2xl mb-4">Business settings</h1>

      {/* Business Info */}
      <div className={`${T.card} border ${T.border} rounded-xl p-4 mb-4`}>
        <p className="text-xs font-semibold mb-3 uppercase tracking-wide text-indigo-600">Business Information</p>
        <Field T={T} label="Business name"><input className={inputCls(T)} value={f.name || ""} onChange={set("name")} /></Field>
        <Field T={T} label="GSTIN"><input className={inputCls(T)} value={f.gstin || ""} onChange={set("gstin")} /></Field>
        <Field T={T} label="State (used for CGST/SGST vs IGST)">
          <select className={inputCls(T)} value={f.state} onChange={set("state")}>
            {INDIAN_STATES.map((s) => <option key={s} value={s}>{stateWithCode(s)}</option>)}
          </select>
        </Field>
        <Field T={T} label="Address"><input className={inputCls(T)} value={f.address || ""} onChange={set("address")} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field T={T} label="Phone"><input className={inputCls(T)} value={f.phone || ""} onChange={set("phone")} /></Field>
          <Field T={T} label="Email"><input className={inputCls(T)} value={f.email || ""} onChange={set("email")} placeholder="yourshop@email.com" /></Field>
        </div>
      </div>

      {/* Bank Details */}
      <div className={`${T.card} border ${T.border} rounded-xl p-4 mb-4`}>
        <p className="text-xs font-semibold mb-3 uppercase tracking-wide text-indigo-600">Bank Details</p>
        <div className="grid grid-cols-2 gap-3">
          <Field T={T} label="Bank Name"><input className={inputCls(T)} value={f.bankName || ""} onChange={set("bankName")} placeholder="e.g. City Union Bank" /></Field>
          <Field T={T} label="Account Name"><input className={inputCls(T)} value={f.accountName || ""} onChange={set("accountName")} placeholder="Name on account" /></Field>
          <Field T={T} label="Account Number"><input className={inputCls(T)} value={f.accountNo || ""} onChange={set("accountNo")} placeholder="e.g. 510909010308016" /></Field>
          <Field T={T} label="IFSC Code"><input className={inputCls(T)} value={f.ifsc || ""} onChange={set("ifsc")} placeholder="e.g. CIUB0000163" /></Field>
        </div>
        {(f.bankName || f.accountNo) && (
          <div className={`mt-2 rounded-lg border ${T.border} px-3 py-2 text-xs ${T.sub}`}>
            Preview on invoice: <strong>{f.bankName}</strong> · A/c: {f.accountNo} · IFSC: {f.ifsc}
          </div>
        )}
      </div>

      {/* Invoice Format */}
      <div className={`${T.card} border ${T.border} rounded-xl p-4 mb-4`}>
        <p className="text-xs font-semibold mb-3 uppercase tracking-wide text-indigo-600">Invoice Number Format</p>
        <Field T={T} label="Invoice prefix (e.g. SVT, ABC, SHOP)">
          <input className={inputCls(T)} value={f.invoicePrefix || ""} onChange={set("invoicePrefix")} placeholder="e.g. SVT" maxLength={10} />
        </Field>
        <div className={`rounded-lg border ${T.border} px-3 py-2 mb-2 flex items-center justify-between`}>
          <span className={`text-xs ${T.sub}`}>Next invoice will look like:</span>
          <span className="text-sm font-bold text-amber-600">{previewNumber}</span>
        </div>
        <p className={`text-xs ${T.sub}`}>Format: PREFIX / SEQUENCE / FINANCIAL-YEAR · Resets label every April 1st.</p>
      </div>

      {/* Declaration */}
      <div className={`${T.card} border ${T.border} rounded-xl p-4 mb-4`}>
        <p className="text-xs font-semibold mb-3 uppercase tracking-wide text-indigo-600">Invoice Declaration</p>
        <Field T={T} label="Declaration text (printed at bottom of invoice)">
          <textarea className={inputCls(T) + " resize-none"} rows={3} value={f.declaration || ""} onChange={set("declaration")} placeholder="We declare that this invoice shows the actual price..." />
        </Field>
      </div>

      <button onClick={save} className="w-full flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-400 text-indigo-950 font-semibold text-sm py-3 rounded-lg">
        {saved ? <><CheckCircle2 size={15} /> Saved!</> : <><Save size={15} /> Save all settings</>}
      </button>
    </div>
  );
}
