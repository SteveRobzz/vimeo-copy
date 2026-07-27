"use client";

import Link from "next/link";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { initialOf } from "@/lib/loop";

// Global Loop header: brand, centered search, Studio + Upload nav, avatar.
export default function LoopHeader({ userLabel }: { userLabel: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [query, setQuery] = useState("");

  // Keep the box in sync with the URL's ?q= when on the home feed.
  useEffect(() => {
    setQuery(params.get("q") ?? "");
  }, [params]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const q = query.trim();
    router.push(q ? `/?q=${encodeURIComponent(q)}` : "/");
  }

  const onStudio = pathname.startsWith("/dashboard");

  return (
    <header className="sticky top-0 z-30 flex items-center gap-6 border-b border-line bg-[oklch(0.99_0.004_250/0.92)] px-4 py-2.5 backdrop-blur-md sm:px-8">
      <Link href="/" className="flex flex-shrink-0 items-center gap-2">
        <span className="flex h-[26px] w-[26px] items-center justify-center rounded-lg bg-accent">
          <span className="ml-0.5 h-0 w-0 border-y-[5px] border-l-[8px] border-y-transparent border-l-white" />
        </span>
        <span className="text-[19px] font-extrabold tracking-tight">vimeo(copy)</span>
      </Link>

      <form onSubmit={submit} className="relative mx-auto hidden w-full max-w-[560px] flex-1 sm:block">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search videos, channels..."
          className="w-full rounded-[10px] border border-line2 bg-panel py-[9px] pl-9 pr-3.5 text-sm outline-none focus:border-accent"
        />
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[13px] text-ink3">
          ⌕
        </span>
      </form>

      <nav className="flex flex-shrink-0 items-center gap-3 sm:gap-[18px]">
        <Link
          href="/dashboard"
          className={`text-sm font-semibold ${onStudio ? "text-accent" : "text-ink2 hover:text-ink"}`}
        >
          Studio
        </Link>
        <Link
          href="/upload"
          className="rounded-[9px] bg-accent px-4 py-[9px] text-sm font-bold text-white transition hover:bg-accent-hover"
        >
          Upload
        </Link>
        <Link
          href="/profile"
          aria-label="Profile"
          className="flex h-[34px] w-[34px] flex-shrink-0 items-center justify-center rounded-full bg-accent-soft text-[13px] font-bold text-[oklch(0.3_0.08_264)]"
        >
          {initialOf(userLabel)}
        </Link>
      </nav>
    </header>
  );
}
