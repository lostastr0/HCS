import { useEffect, useMemo, useRef, useState } from "react";

/* =========================
   Store data
========================= */
const STORE = {
  name: "Hawthorne Corner Store",
  suburb: "331 Hawthorne Rd, Hawthorne, QLD",
  phoneDisplay: "(07) 3399 6611",
  phoneTel: "+61733996611",
  mapsQuery: "Hawthorne Corner Store Hawthorne QLD",
};

// TODO: Replace with the exact Google Maps “Share” link for the store (best accuracy).
const GOOGLE_REVIEWS_URL =
  "https://www.google.com/search?q=Hawthorne+Corner+Store+Hawthorne+QLD&hl=en";

const LAST_UPDATED_LABEL = "December 2025";

/* =========================
   Specials (edit anytime)
========================= */
const SPECIALS = {
  heading: "Highlighted specials",
  subheading: "Ongoing specials and popular picks — available while stocks last.",
  note: "Specials may run for extended periods, but availability depends on stock.",
  items: [
    {
      enabled: true,
      badge: "Featured",
      title: "Featured picks",
      desc: "EDIT HERE: Put your best long-running specials here.",
    },
    {
      enabled: true,
      badge: "Ongoing",
      title: "Ongoing specials",
      desc: "EDIT HERE: Deals that stick around for weeks/months.",
    },
    {
      enabled: true,
      badge: "Popular",
      title: "New / popular stock",
      desc: "EDIT HERE: Imported snacks/drinks or what people ask for most.",
    },
  ],
};

const HOURS = [
  { day: "Monday", open: "06:30", close: "20:00" },
  { day: "Tuesday", open: "06:30", close: "20:00" },
  { day: "Wednesday", open: "06:30", close: "20:00" },
  { day: "Thursday", open: "06:30", close: "20:00" },
  { day: "Friday", open: "06:30", close: "20:00" },
  { day: "Saturday", open: "07:30", close: "20:00" },
  { day: "Sunday", open: "07:30", close: "20:00" },
];

/* =========================
   Public holidays (QLD + National)
   Format: YYYY-MM-DD
   NOTE: Add future years as needed.
========================= */
const PUBLIC_HOLIDAYS = [
  // 2025
  { date: "2025-12-25", name: "Christmas Day", scope: "National" },
  { date: "2025-12-26", name: "Boxing Day", scope: "National" },

  // 2026 (National)
  { date: "2026-01-01", name: "New Year’s Day", scope: "National" },
  { date: "2026-01-26", name: "Australia Day", scope: "National" },
  { date: "2026-04-03", name: "Good Friday", scope: "National" },
  { date: "2026-04-04", name: "Easter Saturday", scope: "National" },
  { date: "2026-04-06", name: "Easter Monday", scope: "National" },
  { date: "2026-04-25", name: "Anzac Day", scope: "National" },
  { date: "2026-12-25", name: "Christmas Day", scope: "National" },
  { date: "2026-12-26", name: "Boxing Day", scope: "National" },

  // 2026 (QLD)
  { date: "2026-05-04", name: "Labour Day (QLD)", scope: "QLD" },
  { date: "2026-10-05", name: "King’s Birthday (QLD)", scope: "QLD" },

  // TODO: Add Ekka / regional holidays if relevant to your area and year.
];

/* =========================
   Time + date helpers
========================= */
function toMinutes(hhmm) {
  const [h, m] = String(hhmm).split(":").map(Number);
  return h * 60 + m;
}

function formatTime(hhmm) {
  let [h, m] = String(hhmm).split(":").map(Number);
  const ampm = h >= 12 ? "pm" : "am";
  h = h % 12 || 12;
  return `${h}:${String(m).padStart(2, "0")} ${ampm}`;
}

function pad2(n) {
  return String(n).padStart(2, "0");
}

function toISODateLocal(d) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function dayNameFromDate(dateObj) {
  return dateObj.toLocaleDateString("en-AU", { weekday: "long" });
}

function shortDay(dayName) {
  const map = {
    Monday: "Mon",
    Tuesday: "Tue",
    Wednesday: "Wed",
    Thursday: "Thu",
    Friday: "Fri",
    Saturday: "Sat",
    Sunday: "Sun",
  };
  return map[dayName] || dayName;
}

function formatShortDate(dateObj) {
  return dateObj.toLocaleDateString("en-AU", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

function isHoliday(dateObj) {
  const iso = toISODateLocal(dateObj);
  const hit = PUBLIC_HOLIDAYS.find((h) => h.date === iso);
  return hit ? { isHoliday: true, ...hit } : { isHoliday: false };
}

/* =========================
   Store closure overrides
   Always closed on Christmas Day (any year)
========================= */
function isChristmasDay(d) {
  return d.getMonth() === 11 && d.getDate() === 25;
}

function getForcedClosure(dateObj) {
  if (isChristmasDay(dateObj)) {
    return { forcedClosed: true, reason: "Christmas Day", note: "Closed all day" };
  }
  return { forcedClosed: false, reason: null, note: null };
}

/* =========================
   Next open logic
========================= */
function findNextOpen(now) {
  for (let offsetDays = 0; offsetDays < 14; offsetDays++) {
    const d = new Date(now);
    d.setDate(now.getDate() + offsetDays);

    const forced = getForcedClosure(d);
    if (forced.forcedClosed) continue;

    const dn = dayNameFromDate(d);
    const hours = HOURS.find((x) => x.day === dn);
    if (!hours) continue;

    if (offsetDays === 0) {
      const minutesNow = now.getHours() * 60 + now.getMinutes();
      if (minutesNow < toMinutes(hours.open)) return { day: dn, open: hours.open };
      continue;
    }

    return { day: dn, open: hours.open };
  }
  return null;
}

function getOpenStatus(now = new Date(), closingSoonMins = 45) {
  const dayName = dayNameFromDate(now);

  const forced = getForcedClosure(now);
  if (forced.forcedClosed) {
    const tomorrow = new Date(now);
    tomorrow.setDate(now.getDate() + 1);
    const next = findNextOpen(tomorrow);

    const nextLabel = next
      ? `Closed today • ${forced.reason} • Opens ${shortDay(next.day)} ${formatTime(next.open)}`
      : `Closed today • ${forced.reason}`;

    return {
      isOpen: false,
      closingSoon: false,
      minsToClose: null,
      dayName,
      label: nextLabel,
      forcedClosed: true,
      forcedReason: forced.reason,
    };
  }

  const today = HOURS.find((d) => d.day === dayName);
  if (!today) {
    return {
      isOpen: false,
      closingSoon: false,
      minsToClose: null,
      dayName,
      label: "Hours unavailable",
    };
  }

  const minutesNow = now.getHours() * 60 + now.getMinutes();
  const openMins = toMinutes(today.open);
  const closeMins = toMinutes(today.close);
  const isOpen = minutesNow >= openMins && minutesNow < closeMins;

  if (isOpen) {
    const minsToClose = closeMins - minutesNow;
    const closingSoon = minsToClose <= closingSoonMins;
    return {
      isOpen: true,
      closingSoon,
      minsToClose,
      dayName,
      label: closingSoon
        ? `Open now • Closing soon (${minsToClose} min) • Closes ${formatTime(today.close)}`
        : `Open now • Closes ${formatTime(today.close)}`,
    };
  }

  const next = findNextOpen(now);
  if (!next) {
    return {
      isOpen: false,
      closingSoon: false,
      minsToClose: null,
      dayName,
      label: "Closed • Hours unavailable",
    };
  }

  const nextLabel =
    next.day === dayName
      ? `Closed • Opens ${formatTime(next.open)}`
      : `Closed • Opens ${shortDay(next.day)} ${formatTime(next.open)}`;

  return { isOpen: false, closingSoon: false, minsToClose: null, dayName, label: nextLabel };
}

/* =========================
   Theme helpers
========================= */
function getInitialTheme() {
  const stored = localStorage.getItem("theme");
  if (stored === "light" || stored === "dark") return stored;

  const systemPrefersDark =
    window.matchMedia?.("(prefers-color-scheme: dark)")?.matches ?? false;

  return systemPrefersDark ? "dark" : "light";
}

/* =========================
   Subtle reveal on scroll
========================= */
function useRevealOnScroll(options = { rootMargin: "0px 0px -10% 0px", threshold: 0.12 }) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const prefersReduced =
      window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false;

    if (prefersReduced) {
      setVisible(true);
      return;
    }

    const io = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setVisible(true);
        io.disconnect();
      }
    }, options);

    io.observe(el);
    return () => io.disconnect();
  }, [options]);

  return { ref, visible };
}

/* =========================
   UI bits
========================= */
function LastUpdated({ label }) {
  return <p className="mt-4 text-xs text-stone-500 dark:text-stone-500">Last updated: {label}</p>;
}

function SectionLabel({ children }) {
  return (
    <div className="text-[11px] tracking-[0.16em] uppercase text-stone-500 dark:text-stone-400 font-semibold">
      {children}
    </div>
  );
}

function SectionHeader({ label, title, subtitle, right }) {
  return (
    <div className="flex items-end justify-between gap-4 flex-wrap">
      <div>
        {label ? <SectionLabel>{label}</SectionLabel> : null}
        <h3 className="mt-2 text-2xl font-bold tracking-tight">{title}</h3>
        {subtitle ? (
          <p className="mt-2 text-sm text-stone-600 dark:text-stone-300 max-w-2xl">
            {subtitle}
          </p>
        ) : null}
      </div>
      {right ? <div>{right}</div> : null}
    </div>
  );
}

function StatusPill({ status }) {
  const variant = status.isOpen ? (status.closingSoon ? "soon" : "open") : "closed";
  const styles =
    variant === "open"
      ? "text-green-800 dark:text-green-200 border-green-200 dark:border-green-900 bg-green-50 dark:bg-green-950/30"
      : variant === "soon"
      ? "text-amber-900 dark:text-amber-200 border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/25"
      : "text-red-800 dark:text-red-200 border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/25";

  const text = variant === "open" ? "OPEN" : variant === "soon" ? "CLOSING SOON" : "CLOSED";
  return (
    <span className={"text-[11px] font-semibold px-2.5 py-1 rounded-full border " + styles}>
      {text}
    </span>
  );
}

function Pill({ children }) {
  return (
    <span className="text-[11px] font-semibold px-2 py-1 rounded-full border border-stone-200/80 dark:border-stone-800 bg-white/40 dark:bg-[#1a1916] text-stone-600 dark:text-stone-300">
      {children}
    </span>
  );
}

function HolidayTag({ children, tone = "amber" }) {
  const cls =
    tone === "red"
      ? "border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/25 text-red-800 dark:text-red-200"
      : "border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/25 text-amber-900 dark:text-amber-200";

  return (
    <span className={"text-[11px] font-semibold px-2 py-1 rounded-full border " + cls}>
      {children}
    </span>
  );
}

/* =========================
   Date-based schedule rows
========================= */
function buildUpcomingRows(now, days = 7) {
  const rows = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(now);
    d.setHours(12, 0, 0, 0);
    d.setDate(now.getDate() + i);

    const dayName = dayNameFromDate(d);
    const baseHours = HOURS.find((h) => h.day === dayName) || null;

    const holiday = isHoliday(d);
    const forced = getForcedClosure(d);

    rows.push({
      dateObj: d,
      iso: toISODateLocal(d),
      label: formatShortDate(d),
      dayName,
      baseHours,
      holiday,
      forced,
      isToday: i === 0,
    });
  }
  return rows;
}

/* =========================
   App
========================= */
export default function App() {
  const now = new Date();
  const status = getOpenStatus(now, 45);

  const mapsLink = useMemo(
    () =>
      `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(STORE.mapsQuery)}`,
    []
  );

  const mapsEmbed = useMemo(
    () =>
      `https://www.google.com/maps?q=${encodeURIComponent(STORE.mapsQuery)}&output=embed`,
    []
  );

  const [theme, setTheme] = useState("light");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [showMobileCTA, setShowMobileCTA] = useState(false);
  const [mobileCTADismissed, setMobileCTADismissed] = useState(false);

  useEffect(() => {
    const initial = getInitialTheme();
    setTheme(initial);
    document.documentElement.classList.toggle("dark", initial === "dark");
  }, []);

  function toggleTheme() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    localStorage.setItem("theme", next);
    document.documentElement.classList.toggle("dark", next === "dark");
  }

  useEffect(() => {
    function onResize() {
      if (window.innerWidth >= 768) setMobileMenuOpen(false);
    }
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    function onScroll() {
      if (window.innerWidth >= 640) return;

      const scrolledEnough = window.scrollY > 420;

      const contactEl = document.getElementById("contact");
      const nearContact =
        contactEl && contactEl.getBoundingClientRect().top < window.innerHeight * 0.75;

      setShowMobileCTA(scrolledEnough && !nearContact && !mobileCTADismissed);
    }

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [mobileCTADismissed]);

  const ui = {
    page: "min-h-screen bg-[#f6f0e6] text-stone-900 dark:bg-[#161513] dark:text-stone-100",
    header:
      "sticky top-0 z-40 bg-[#f6f0e6]/90 dark:bg-[#161513]/90 backdrop-blur border-b border-stone-200/80 dark:border-stone-800",
    container: "max-w-7xl mx-auto px-6",

    section: "px-6 py-16 border-t border-stone-200/80 dark:border-stone-800",
    sectionAlt:
      "px-6 py-16 border-t border-stone-200/80 dark:border-stone-800 bg-[#f2eadc] dark:bg-[#1d1b18]",

    card:
      "rounded-2xl border border-stone-200/80 dark:border-stone-800 bg-[#fbf6ee] dark:bg-[#1a1916] p-6 transition hover:-translate-y-0.5 hover:shadow-md",
    cardNoPad:
      "rounded-2xl border border-stone-200/80 dark:border-stone-800 bg-[#fbf6ee] dark:bg-[#1a1916] transition hover:-translate-y-0.5 hover:shadow-md",
    infoCard:
      "rounded-2xl border border-stone-200/80 dark:border-stone-800 bg-[#f7efe2] dark:bg-[#201e1b] p-6 transition hover:-translate-y-0.5 hover:shadow-md",

    beigePrimary:
      "min-h-[44px] bg-[#d9c3a6] text-[#2a231b] hover:bg-[#cfb897] transition px-6 py-3 rounded-xl font-semibold shadow-sm border border-[#c9b79f] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c9b79f]/70",
    darkPrimary:
      "min-h-[44px] bg-[#2b241d] text-[#f5efe6] hover:bg-[#3a3128] transition px-6 py-3 rounded-xl font-semibold shadow-sm border border-[#3f352a] dark:bg-[#26211b] dark:hover:bg-[#332b22] dark:border-[#3b3127] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c9b79f]/50",
    beigePrimarySm:
      "min-h-[40px] bg-[#d9c3a6] text-[#2a231b] hover:bg-[#cfb897] transition px-4 py-2 rounded-xl font-semibold shadow-sm border border-[#c9b79f] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c9b79f]/70",
    darkPrimarySm:
      "min-h-[40px] bg-[#2b241d] text-[#f5efe6] hover:bg-[#3a3128] transition px-4 py-2 rounded-xl font-semibold shadow-sm border border-[#3f352a] dark:bg-[#26211b] dark:hover:bg-[#332b22] dark:border-[#3b3127] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c9b79f]/50",

    revealBase: "transition-all duration-700 ease-out will-change-transform will-change-opacity",
    revealHidden: "opacity-0 translate-y-4",
    revealVisible: "opacity-100 translate-y-0",
  };

  const navLinks = [
    ["#instore", "In store"],
    ["#specials", "Specials"],
    ["#services", "Services"],
    ["#range", "More range"],
    ["#hours", "Hours"],
    ["#contact", "Contact"],
  ];

  const essentials = [
    { emoji: "🥤", title: "Cold drinks", desc: "Local favourites, plus a small range of American drinks." },
    { emoji: "🍫", title: "Snacks", desc: "Everyday snacks, with some American and Kiwi options available." },
    { emoji: "🧻", title: "Everyday essentials", desc: "Local basics when you need them." },
  ];

  const extraRange = [
    { emoji: "🛞", title: "Hand trolley wheels", desc: "Replacement wheels available in store." },
    { emoji: "🛞", title: "Wheelbarrow wheels", desc: "A small range of options available." },
    { emoji: "🧰", title: "Hand tools & socket sets", desc: "Handy items for quick jobs." },
  ];

  const rHero = useRevealOnScroll();
  const rInstore = useRevealOnScroll();
  const rSpecials = useRevealOnScroll();
  const rServices = useRevealOnScroll();
  const rRange = useRevealOnScroll();
  const rHours = useRevealOnScroll();
  const rContact = useRevealOnScroll();

  const upcomingRows = useMemo(() => buildUpcomingRows(now, 7), [now]);
  const todayHoliday = isHoliday(now);
  const forcedToday = getForcedClosure(now);

  const todaysHours = HOURS.find((h) => h.day === status.dayName);

  return (
    <div className={ui.page}>
      {/* Header */}
      <header className={ui.header}>
        <div className={`${ui.container} py-4 flex items-center justify-between`}>
          <div className="flex items-center gap-3 min-w-0">
            <div className="min-w-0">
              <div className="text-base sm:text-lg font-bold tracking-tight truncate">
                {STORE.name}
              </div>
              <div className="text-xs text-stone-500 dark:text-stone-400 truncate">
                {STORE.suburb}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <nav className="hidden md:flex gap-1 text-sm text-stone-700 dark:text-stone-200">
              {navLinks.map(([href, label]) => (
                <a
                  key={href}
                  href={href}
                  className="rounded-xl px-3 py-2 hover:bg-stone-200/70 dark:hover:bg-stone-800/60 hover:text-stone-950 dark:hover:text-white transition
                             focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c9b79f]/60"
                >
                  {label}
                </a>
              ))}
            </nav>

            <button
              onClick={() => setMobileMenuOpen((v) => !v)}
              className="md:hidden min-h-[40px] px-3 rounded-xl border border-stone-300 dark:border-stone-700 bg-white/40 dark:bg-[#1a1916]
                         hover:bg-white/60 dark:hover:bg-stone-800/60 transition
                         focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c9b79f]/60"
              aria-label="Open menu"
              aria-expanded={mobileMenuOpen}
            >
              {mobileMenuOpen ? "✕" : "Menu"}
            </button>

            <button
              onClick={toggleTheme}
              className="min-h-[40px] text-sm border border-stone-300 dark:border-stone-700 px-3 rounded-xl bg-white/40 dark:bg-[#1a1916]
                         hover:bg-white/60 dark:hover:bg-stone-800/60 transition
                         focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c9b79f]/60"
              aria-label="Toggle theme"
              title="Toggle theme"
            >
              {theme === "dark" ? "🌙" : "☀️"}
            </button>
          </div>
        </div>

        {mobileMenuOpen && (
          <div className="md:hidden border-t border-stone-200/80 dark:border-stone-800">
            <div className={`${ui.container} py-3`}>
              <div className="grid gap-2">
                {navLinks.map(([href, label]) => (
                  <a
                    key={href}
                    href={href}
                    onClick={() => setMobileMenuOpen(false)}
                    className="w-full rounded-2xl border border-stone-200/80 dark:border-stone-800 bg-white/30 dark:bg-[#1a1916] px-4 py-3 text-sm font-semibold
                               hover:bg-white/50 dark:hover:bg-stone-800/60 transition
                               focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c9b79f]/60"
                  >
                    {label}
                  </a>
                ))}
              </div>
            </div>
          </div>
        )}
      </header>

      {/* Hero */}
      <main
        ref={rHero.ref}
        className={`${ui.container} py-12 sm:py-16 ${ui.revealBase} ${
          rHero.visible ? ui.revealVisible : ui.revealHidden
        }`}
      >
        <div className="grid gap-10 lg:grid-cols-2 items-start">
          {/* Left */}
          <div>
            <SectionLabel>HAWTHORNE • LOCAL CONVENIENCE</SectionLabel>

            <h1 className="mt-3 text-4xl sm:text-5xl font-extrabold tracking-tight leading-[1.05]">
              Small store.
              <span className="block">Reliable every day.</span>
            </h1>

            <p className="mt-4 text-lg text-stone-700 dark:text-stone-300 max-w-2xl leading-relaxed">
              Snacks, cold drinks and essentials — including some American & Kiwi favourites.
              Dry cleaning drop-off and collection available in store.
            </p>

            <div className="mt-8 flex gap-3 flex-wrap">
              <a href={`tel:${STORE.phoneTel}`} className={ui.beigePrimary}>
                Call Store
              </a>
              <a href={mapsLink} target="_blank" rel="noreferrer" className={ui.darkPrimary}>
                Directions
              </a>
              <a href={GOOGLE_REVIEWS_URL} target="_blank" rel="noreferrer" className={ui.darkPrimary}>
                Google Reviews
              </a>
            </div>

            <p className="mt-4 text-xs text-stone-500 dark:text-stone-500">
              Stock can change — call if you’re chasing something specific.
            </p>
          </div>

          {/* Right: photo + overlay store info */}
          <div className="relative">
            <div className={ui.cardNoPad}>
              <div className="relative overflow-hidden rounded-2xl">
                <div className="h-[340px] sm:h-[420px] bg-[#f2eadc] dark:bg-[#201e1b] grid place-items-center text-sm text-stone-500 dark:text-stone-400">
                  Storefront photo placeholder
                </div>
                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-black/10 to-transparent dark:from-black/35" />
              </div>
            </div>

            <div className="absolute -bottom-5 left-4 right-4 sm:left-6 sm:right-6">
              <div className="rounded-2xl border border-stone-200/80 dark:border-stone-800 bg-[#fbf6ee]/95 dark:bg-[#1a1916]/95 p-4 shadow-lg">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-3">
                    <StatusPill status={status} />
                    <div className="text-sm font-semibold">{STORE.name}</div>
                  </div>
                  <div className="text-xs text-stone-500 dark:text-stone-400">{STORE.suburb}</div>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-xl border border-stone-200/80 dark:border-stone-800 bg-white/40 dark:bg-black/10 px-3 py-2">
                    <div className="text-xs text-stone-500 dark:text-stone-400">Today</div>
                    <div className="font-semibold">{status.dayName}</div>
                  </div>

                  <div className="rounded-xl border border-stone-200/80 dark:border-stone-800 bg-white/40 dark:bg-black/10 px-3 py-2">
                    <div className="text-xs text-stone-500 dark:text-stone-400">Hours</div>
                    <div className="font-semibold">
                      {forcedToday.forcedClosed
                        ? "Closed"
                        : todaysHours
                        ? `${formatTime(todaysHours.open)} – ${formatTime(todaysHours.close)}`
                        : "—"}
                    </div>
                  </div>
                </div>

                {(todayHoliday.isHoliday || forcedToday.forcedClosed) && (
                  <div className="mt-3 text-xs text-stone-600 dark:text-stone-400">
                    {forcedToday.forcedClosed
                      ? "Closed today — Christmas Day."
                      : `Public holiday: ${todayHoliday.name}. Hours may differ.`}
                  </div>
                )}
              </div>
            </div>

            <div className="h-8" />
          </div>
        </div>
      </main>

      {/* In store */}
      <section id="instore" className={ui.sectionAlt}>
        <div
          ref={rInstore.ref}
          className={`max-w-7xl mx-auto ${ui.revealBase} ${
            rInstore.visible ? ui.revealVisible : ui.revealHidden
          }`}
        >
          <SectionHeader label="IN STORE" title="Everyday basics" subtitle="The essentials — quick, local, and easy." />

          <div className="mt-7 grid gap-4 md:grid-cols-3">
            {essentials.map((item) => (
              <div key={item.title} className={ui.card}>
                <div className="flex items-start gap-4">
                  <span className="text-2xl leading-none" aria-hidden="true">{item.emoji}</span>
                  <div>
                    <h4 className="font-semibold mb-1">{item.title}</h4>
                    <p className="text-sm text-stone-600 dark:text-stone-400 leading-relaxed">{item.desc}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <p className="mt-4 text-xs text-stone-500 dark:text-stone-500">
            Imported items and specialty stock may vary depending on availability.
          </p>
        </div>
      </section>

      {/* Specials */}
      <section id="specials" className={ui.section}>
        <div
          ref={rSpecials.ref}
          className={`max-w-7xl mx-auto ${ui.revealBase} ${
            rSpecials.visible ? ui.revealVisible : ui.revealHidden
          }`}
        >
          <SectionHeader label="SPECIALS" title={SPECIALS.heading} subtitle={SPECIALS.subheading} />

          <div className="mt-7 grid gap-4 md:grid-cols-3">
            {SPECIALS.items.filter((s) => s.enabled).map((item) => (
              <div key={item.title} className={ui.card}>
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <h4 className="font-semibold">{item.title}</h4>
                  {item.badge ? <Pill>{item.badge}</Pill> : null}
                </div>
                <p className="mt-2 text-sm text-stone-600 dark:text-stone-400 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>

          <p className="mt-4 text-xs text-stone-500 dark:text-stone-500">{SPECIALS.note}</p>
          <LastUpdated label={LAST_UPDATED_LABEL} />
        </div>
      </section>

      {/* Services */}
      <section id="services" className={ui.sectionAlt}>
        <div
          ref={rServices.ref}
          className={`max-w-7xl mx-auto ${ui.revealBase} ${
            rServices.visible ? ui.revealVisible : ui.revealHidden
          }`}
        >
          <SectionHeader label="SERVICES" title="Dry cleaning" subtitle="Drop-off and collection available in store." />

          <div className="mt-7 grid gap-6 lg:grid-cols-2">
            <div className={ui.infoCard}>
              <p className="text-stone-700 dark:text-stone-300 leading-relaxed">
                Convenient drop-off and collection in store. Cleaning is completed by an external professional provider.
              </p>

              <div className="mt-4 grid gap-2 text-sm text-stone-700 dark:text-stone-300">
                <div className="flex items-start gap-3"><span aria-hidden>1️⃣</span><span>Drop off in store</span></div>
                <div className="flex items-start gap-3"><span aria-hidden>2️⃣</span><span>Sent to our dry cleaning partner</span></div>
                <div className="flex items-start gap-3"><span aria-hidden>3️⃣</span><span>Pick up when ready</span></div>
              </div>

              <p className="mt-4 text-xs text-stone-500 dark:text-stone-500">Turnaround times and pricing may vary.</p>
            </div>

            <div className={ui.card}>
              <h4 className="font-semibold mb-2">Dry cleaning details</h4>
              <p className="text-sm text-stone-600 dark:text-stone-400">Details to be confirmed.</p>
            </div>
          </div>
        </div>
      </section>

      {/* More range */}
      <section id="range" className={ui.section}>
        <div
          ref={rRange.ref}
          className={`max-w-7xl mx-auto ${ui.revealBase} ${
            rRange.visible ? ui.revealVisible : ui.revealHidden
          }`}
        >
          <SectionHeader label="MORE RANGE" title="Handy extras" subtitle="A small selection of tools and replacement wheels available." />

          <div className="mt-7 grid gap-4 md:grid-cols-3">
            {extraRange.map((item) => (
              <div key={item.title} className={ui.card}>
                <div className="flex items-start gap-4">
                  <span className="text-2xl leading-none" aria-hidden="true">{item.emoji}</span>
                  <div>
                    <h4 className="font-semibold mb-1">{item.title}</h4>
                    <p className="text-sm text-stone-600 dark:text-stone-400 leading-relaxed">{item.desc}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Hours */}
      <section id="hours" className={ui.sectionAlt}>
        <div
          ref={rHours.ref}
          className={`max-w-7xl mx-auto ${ui.revealBase} ${
            rHours.visible ? ui.revealVisible : ui.revealHidden
          }`}
        >
          <SectionHeader
            label="HOURS"
            title="Opening hours"
            subtitle="Next 7 days (public holidays flagged)."
            right={<span className="text-xs text-stone-500 dark:text-stone-400">{status.label}</span>}
          />

          <div className="mt-6 rounded-2xl border border-stone-200/80 dark:border-stone-800 bg-[#fbf6ee] dark:bg-[#1a1916] overflow-hidden">
            <div className="divide-y divide-stone-200/80 dark:divide-stone-800">
              {upcomingRows.map((row) => {
                const xmasClosed = row.forced.forcedClosed;
                const ph = row.holiday.isHoliday && !xmasClosed;

                const timeText = xmasClosed
                  ? "Closed"
                  : row.baseHours
                  ? `${formatTime(row.baseHours.open)} – ${formatTime(row.baseHours.close)}`
                  : "—";

                return (
                  <div
                    key={row.iso}
                    className={[
                      "px-6 py-4",
                      // FIX: don’t use a background fill for Today (it blended in).
                      // Instead: subtle left border + dot so it always reads, but still “clean”.
                      row.isToday ? "border-l-4 border-[#c9b79f] dark:border-[#c9b79f] bg-transparent" : "border-l-4 border-transparent",
                    ].join(" ")}
                  >
                    <div className="flex items-center justify-between gap-4 flex-wrap">
                      <div className="flex items-center gap-3">
                        {row.isToday ? (
                          <span className="inline-flex h-2 w-2 rounded-full bg-[#c9b79f]" aria-hidden="true" />
                        ) : null}

                        <div className="font-semibold">
                          {row.label}
                          {row.isToday ? <span className="ml-2 text-xs text-stone-500">Today</span> : null}
                        </div>

                        {xmasClosed ? <HolidayTag tone="red">Closed</HolidayTag> : null}
                        {ph ? <HolidayTag>Public holiday</HolidayTag> : null}
                      </div>

                      <div className="text-stone-700 dark:text-stone-300 font-semibold">{timeText}</div>
                    </div>

                    {xmasClosed ? (
                      <div className="mt-1 text-xs text-stone-600 dark:text-stone-400">
                        Christmas Day • Closed all day
                      </div>
                    ) : ph ? (
                      <div className="mt-1 text-xs text-stone-600 dark:text-stone-400">
                        {row.holiday.name} • Hours may differ
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>

          <p className="mt-3 text-xs text-stone-500 dark:text-stone-500">
            Standard hours apply unless otherwise noted. Hours may change on public holidays.
          </p>
          <LastUpdated label={LAST_UPDATED_LABEL} />
        </div>
      </section>

      {/* Contact */}
      <section id="contact" className={ui.section}>
        <div
          ref={rContact.ref}
          className={`max-w-7xl mx-auto ${ui.revealBase} ${
            rContact.visible ? ui.revealVisible : ui.revealHidden
          }`}
        >
          <SectionHeader label="CONTACT" title="Find us" subtitle="Call, check reviews, or get directions." />

          {/* FIX: items-start prevents left card stretching to match map height */}
          <div className="mt-7 grid gap-8 lg:grid-cols-2 items-start">
            {/* FIX: h-fit ensures no extra whitespace */}
            <div className={`${ui.card} h-fit`}>
              <div className="space-y-2">
                <p className="text-stone-700 dark:text-stone-300">
                  📍 <span className="font-semibold">{STORE.suburb}</span>
                </p>

                <p className="text-stone-700 dark:text-stone-300">
                  📞{" "}
                  <a
                    href={`tel:${STORE.phoneTel}`}
                    className="font-semibold underline decoration-stone-300 dark:decoration-stone-700 hover:decoration-stone-500"
                  >
                    {STORE.phoneDisplay}
                  </a>
                </p>

                <p className={`text-sm ${status.isOpen ? "text-green-700 dark:text-green-300" : "text-red-700 dark:text-red-300"}`}>
                  {status.isOpen ? "● Open now" : "● Closed now"}{" "}
                  <span className="text-stone-500 dark:text-stone-400">— {status.label}</span>
                </p>

                <div className="pt-4 flex gap-3 flex-wrap">
                  <a className={ui.beigePrimarySm} href={`tel:${STORE.phoneTel}`}>
                    Call Store
                  </a>
                  <a className={ui.darkPrimarySm} href={mapsLink} target="_blank" rel="noreferrer">
                    Directions
                  </a>
                  <a className={ui.darkPrimarySm} href={GOOGLE_REVIEWS_URL} target="_blank" rel="noreferrer">
                    ⭐ Google Reviews
                  </a>
                </div>
              </div>
            </div>

            <div className="rounded-2xl overflow-hidden border border-stone-200/80 dark:border-stone-800 bg-[#fbf6ee] dark:bg-[#1a1916]">
              <iframe
                title="Map"
                src={mapsEmbed}
                className="w-full h-[320px] md:h-[380px]"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Mobile quick actions */}
      {showMobileCTA && (
        <div className="sm:hidden fixed bottom-4 left-0 right-0 px-4 z-50">
          <div className="rounded-2xl border border-stone-200/80 dark:border-stone-800 bg-[#fbf6ee]/95 dark:bg-[#1a1916]/95 shadow-lg p-2">
            <div className="flex items-center justify-between px-2 pb-2">
              <div className="text-xs text-stone-500 dark:text-stone-400">Quick actions</div>
              <button
                onClick={() => setMobileCTADismissed(true)}
                className="min-h-[32px] px-2 rounded-lg text-sm border border-stone-200/80 dark:border-stone-800 bg-white/30 dark:bg-black/10
                           hover:bg-white/50 dark:hover:bg-stone-800/60 transition
                           focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c9b79f]/60"
                aria-label="Dismiss quick actions"
                title="Dismiss"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <a href={`tel:${STORE.phoneTel}`} className={ui.beigePrimary}>
                Call
              </a>
              <a href={mapsLink} target="_blank" rel="noreferrer" className={ui.darkPrimary}>
                Directions
              </a>
            </div>
          </div>
        </div>
      )}

      <div className="sm:hidden h-24" />

      {/* Footer */}
      {/* Footer */}
<footer className="px-6 py-10 border-t border-stone-200/80 dark:border-stone-800 bg-[#f2eadc] dark:bg-[#1d1b18]">
  <div className="max-w-7xl mx-auto grid gap-6 sm:grid-cols-3 text-sm text-stone-600 dark:text-stone-400">
    {/* Store */}
    <div>
      <div className="font-semibold text-stone-900 dark:text-stone-100">
        {STORE.name}
      </div>
      <div>{STORE.suburb}</div>
    </div>

    {/* Phone */}
    <div>
      <div className="font-semibold text-stone-900 dark:text-stone-100">
        Phone
      </div>
      <div>{STORE.phoneDisplay}</div>
    </div>

    {/* Status */}
    <div>
      <div className="font-semibold text-stone-900 dark:text-stone-100">
        Status
      </div>
      <div
        className={
          status.isOpen
            ? "text-green-700 dark:text-green-300"
            : "text-red-700 dark:text-red-300"
        }
      >
        {status.label}
      </div>
    </div>
  </div>

  {/* Copyright */}
  <div className="max-w-7xl mx-auto text-xs text-stone-500 dark:text-stone-500 mt-6 text-center">
    © {new Date().getFullYear()} {STORE.name}
  </div>

  {/* Credits */}
  <div className="max-w-7xl mx-auto text-xs text-stone-500 dark:text-stone-500 mt-2 text-center">
    Made by{" "}
    <a
      href="https://lostastr0.dev"
      target="_blank"
      rel="noreferrer"
      className="font-semibold text-stone-700 dark:text-stone-300 underline decoration-stone-300 dark:decoration-stone-700 hover:decoration-stone-500"
    >
      lostastr0
    </a>{" "}
    • Hosted on{" "}
    <a
      href="https://vercel.com"
      target="_blank"
      rel="noreferrer"
      className="underline decoration-stone-300 dark:decoration-stone-700 hover:decoration-stone-500"
    >
      Vercel
    </a>
  </div>
</footer>

    </div>
  );
}
