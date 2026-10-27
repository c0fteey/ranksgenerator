"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { authClient } from "@/lib/auth-client";

export function UserMenu({ name, email, image }: { name: string; email: string; image: string | null }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  return (
    <div className="flex items-center gap-3 sm:gap-4">
      <div className="flex min-w-0 items-center gap-3">
        {image ? (
          <Image src={image} alt="" width={40} height={40} className="size-9 shrink-0 rounded-full sm:size-10" />
        ) : (
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-raised text-sm font-semibold sm:size-10">{name.slice(0, 1).toUpperCase()}</span>
        )}
        <div className="hidden min-w-0 leading-tight sm:block">
          <div className="truncate text-sm font-semibold">{name}</div>
          <div className="truncate text-xs text-muted">{email}</div>
        </div>
      </div>
      <button
        type="button"
        disabled={pending}
        aria-label="Sign out"
        title="Sign out"
        onClick={async () => {
          setPending(true);
          await authClient.signOut();
          router.replace("/login");
          router.refresh();
        }}
        className="grid size-10 place-items-center rounded-full text-ink transition-colors hover:bg-raised disabled:opacity-50"
      >
        <LogOut className="size-5" aria-hidden />
      </button>
    </div>
  );
}
