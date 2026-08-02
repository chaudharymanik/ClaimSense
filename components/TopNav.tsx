import Link from "next/link";
import LogoutButton from "./LogoutButton";

const NAV_ITEMS = [
  { href: "/claims", label: "DASHBOARD", key: "dashboard" },
  { href: "/claims/new", label: "NEW CLAIM", key: "new-claim" },
  { href: "/claims/review", label: "MANUAL QUEUE", key: "manual-queue" },
] as const;

export default function TopNav({ active }: { active: (typeof NAV_ITEMS)[number]["key"] }) {
  return (
    <nav className="bg-on-secondary-fixed sticky top-0 z-50 shadow-sm">
      {/* Checkbox-hack mobile menu — no client JS needed. Must be a sibling
          of (and precede) the mobile dropdown below for peer-checked to
          reach it; desktop layout below is completely untouched. */}
      <input type="checkbox" id="topnav-mobile-toggle" className="peer hidden" />
      <div className="flex justify-between items-center w-full px-margin-page h-16 max-w-[1440px] mx-auto">
        <div className="flex items-center gap-stack-md">
          <label
            htmlFor="topnav-mobile-toggle"
            aria-label="Toggle navigation menu"
            className="lg:hidden cursor-pointer text-surface-bright flex items-center"
          >
            <span className="material-symbols-outlined">menu</span>
          </label>
          <Link href="/claims" className="flex items-center gap-unit hover:opacity-90 transition-opacity">
            <span className="material-symbols-outlined filled text-surface-bright text-[28px]">policy</span>
            <span className="font-display-md text-display-md text-surface-bright tracking-tight">ClaimSense</span>
          </Link>
        </div>
        <div className="hidden lg:flex items-center gap-stack-lg h-full">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.key}
              href={item.href}
              className={
                item.key === active
                  ? "font-label-caps text-label-caps tracking-widest text-surface-bright border-b-2 border-primary pb-1 h-full flex items-center mt-1"
                  : "font-label-caps text-label-caps tracking-widest text-on-secondary-fixed-variant hover:text-primary transition-colors duration-200 h-full flex items-center"
              }
            >
              {item.label}
            </Link>
          ))}
        </div>
        <div className="hidden lg:flex items-center gap-stack-md">
          {/* Secondary by design (not the primary CTA), not hidden by
              obscurity — reaching /admin still requires the separate admin
              credential (proxy.ts); this is just a real, discoverable entry
              point instead of "type the URL yourself", which is a usability
              gap, not a security one. */}
          <Link
            href="/admin"
            className="font-label-caps text-label-caps tracking-widest text-surface-bright border border-on-secondary-fixed-variant/50 rounded px-3 py-2 hover:border-primary hover:text-primary transition-colors"
          >
            Admin
          </Link>
          <LogoutButton className="font-label-caps text-label-caps tracking-widest text-on-secondary-fixed-variant hover:text-surface-bright transition-colors" />
          <Link
            href="/claims/new"
            className="bg-primary text-on-primary font-label-caps text-label-caps px-4 py-2 rounded flex items-center gap-2 hover:bg-primary-container transition-colors shadow-sm"
          >
            <span className="material-symbols-outlined text-[18px]">add</span>
            New Claim
          </Link>
        </div>
      </div>

      {/* Mobile menu — collapsed by default, shown when the checkbox above is checked. */}
      <div className="hidden peer-checked:flex lg:hidden flex-col gap-1 px-margin-page pb-4">
        {NAV_ITEMS.map((item) => (
          <Link
            key={item.key}
            href={item.href}
            className={
              item.key === active
                ? "font-label-caps text-label-caps tracking-widest text-surface-bright bg-surface-bright/10 rounded px-3 py-3"
                : "font-label-caps text-label-caps tracking-widest text-on-secondary-fixed-variant hover:text-surface-bright px-3 py-3"
            }
          >
            {item.label}
          </Link>
        ))}
        <Link
          href="/admin"
          className="font-label-caps text-label-caps tracking-widest text-surface-bright border border-on-secondary-fixed-variant/50 rounded px-3 py-3 text-center mt-1"
        >
          Admin
        </Link>
        <LogoutButton className="font-label-caps text-label-caps tracking-widest text-on-secondary-fixed-variant hover:text-surface-bright text-left px-3 py-3" />
      </div>
    </nav>
  );
}
