"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import * as Popover from "@radix-ui/react-popover";
import { ChevronDown, LogOut } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { NavLinks, type NavItem } from "./NavLinks";

function Avatar({ name, image, className }: { name: string; image: string | null; className: string }) {
  return image ? (
    <Image src={image} alt="" width={40} height={40} className={`shrink-0 rounded-full ${className}`} />
  ) : (
    <span className={`grid shrink-0 place-items-center rounded-full bg-raised text-sm font-semibold ${className}`}>{name.slice(0, 1).toUpperCase()}</span>
  );
}

/** Profile button; opens a menu with the account, the page links (phones, where the sidebar is hidden) and sign out. */
export function UserMenu({ name, email, image, nav }: { name: string; email: string; image: string | null; nav: NavItem[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger
        aria-label="Account menu"
        className="group flex min-w-0 items-center gap-3 rounded-full p-1 pr-2 transition-colors hover:bg-raised data-[state=open]:bg-raised sm:pr-3"
      >
        <Avatar name={name} image={image} className="size-9 sm:size-10" />
        <span className="hidden min-w-0 text-left leading-tight sm:block">
          <span className="block max-w-48 truncate text-sm font-semibold">{name}</span>
          <span className="block max-w-48 truncate text-xs text-muted">{email}</span>
        </span>
        <ChevronDown className="size-4 shrink-0 text-muted transition-transform group-data-[state=open]:rotate-180" aria-hidden />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={8}
          collisionPadding={12}
          className="z-[60] flex w-[min(18rem,calc(100vw-1.5rem))] flex-col gap-1 rounded-2xl border border-line bg-raised p-2 shadow-2xl shadow-black/60"
        >
          <div className="flex items-center gap-3 px-2 py-2">
            <Avatar name={name} image={image} className="size-10" />
            <div className="min-w-0 leading-tight">
              <div className="truncate text-sm font-semibold">{name}</div>
              <div className="truncate text-xs text-muted">{email}</div>
            </div>
          </div>
          {/* Closing on any click inside: picking a page navigates away. */}
          <nav className="flex flex-col gap-0.5 border-t border-line pt-1 md:hidden" onClick={() => setOpen(false)}>
            <NavLinks items={nav} />
          </nav>
          <div className="border-t border-line pt-1">
            <button
              type="button"
              disabled={pending}
              onClick={async () => {
                setPending(true);
                await authClient.signOut();
                router.replace("/login");
                router.refresh();
              }}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-red-400 transition-colors hover:bg-red-500/10 disabled:opacity-50"
            >
              <LogOut className="size-4" aria-hidden />
              {pending ? "Signing out…" : "Sign out"}
            </button>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
