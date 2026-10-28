"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Brush, History, KeyRound, ShieldCheck } from "lucide-react";

const ICONS = { generator: Brush, history: History, license: KeyRound, admin: ShieldCheck };

export interface NavItem {
  href: string;
  label: string;
  icon: keyof typeof ICONS;
}

export function NavLinks({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  return (
    <>
      {items.map(({ href, label, icon }) => {
        const Icon = ICONS[icon];
        const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`flex shrink-0 items-center gap-3 whitespace-nowrap rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
              active ? "bg-gold/10 text-gold" : "text-ink hover:bg-raised"
            }`}
          >
            <Icon className="size-4" aria-hidden />
            {label}
          </Link>
        );
      })}
    </>
  );
}
