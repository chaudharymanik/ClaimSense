import Link from "next/link";

const NAV_ITEMS = [
  { href: "/claims", label: "DASHBOARD", key: "dashboard" },
  { href: "/claims/new", label: "NEW CLAIM", key: "new-claim" },
  { href: "/claims/review", label: "MANUAL QUEUE", key: "manual-queue" },
] as const;

export default function TopNav({ active }: { active: (typeof NAV_ITEMS)[number]["key"] }) {
  return (
    <nav className="bg-on-secondary-fixed sticky top-0 z-50 shadow-sm">
      <div className="flex justify-between items-center w-full px-margin-page h-16 max-w-[1440px] mx-auto">
        <Link href="/claims" className="flex items-center gap-unit hover:opacity-90 transition-opacity">
          <span className="material-symbols-outlined filled text-surface-bright text-[28px]">policy</span>
          <span className="font-display-md text-display-md text-surface-bright tracking-tight">ClaimSense</span>
        </Link>
        <div className="hidden md:flex items-center gap-stack-lg h-full">
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
        <div className="hidden md:flex items-center">
          <Link
            href="/claims/new"
            className="bg-primary text-on-primary font-label-caps text-label-caps px-4 py-2 rounded flex items-center gap-2 hover:bg-primary-container transition-colors shadow-sm"
          >
            <span className="material-symbols-outlined text-[18px]">add</span>
            New Claim
          </Link>
        </div>
      </div>
    </nav>
  );
}
