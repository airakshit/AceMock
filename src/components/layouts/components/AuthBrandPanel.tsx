import { Layers } from "lucide-react";

import { APP_NAME } from "@/components/layouts/constants";

const HIGHLIGHTS = [
  {
    title: "AI-extracted question banks",
    description: "Turn syllabi and past papers into structured practice sets.",
  },
  {
    title: "Full-length timed simulations",
    description: "Replicate real exam pressure with accurate scoring.",
  },
  {
    title: "Analytics that pinpoint gaps",
    description: "Track accuracy, percentile, and topic-level strengths.",
  },
];

/**
 * BrandPanel — the editorial hero shown beside the auth forms on large screens.
 * Purely presentational; renders no interactive elements.
 */
export function AuthBrandPanel() {
  return (
    <aside className="relative hidden overflow-hidden bg-brand-gradient lg:flex lg:flex-col lg:justify-between lg:p-12">
      {/* Blueprint grid + ambient glows */}
      <div className="pointer-events-none absolute inset-0 bg-grid-fade opacity-40" />
      <div className="pointer-events-none absolute -top-24 -left-24 size-96 rounded-full bg-white/10 blur-3xl" />
      <div className="pointer-events-none absolute -right-32 bottom-0 size-96 rounded-full bg-black/10 blur-3xl" />

      {/* Wordmark */}
      <div className="relative z-10 flex items-center gap-3">
        <div className="flex size-9 items-center justify-center rounded-[10px] bg-white/15 ring-1 ring-inset ring-white/25 backdrop-blur-sm">
          <Layers className="size-4.5 text-white" />
        </div>
        <span className="font-heading text-base font-bold tracking-tight text-white">
          {APP_NAME}
        </span>
      </div>

      {/* Headline */}
      <div className="relative z-10 max-w-md space-y-5">
        <span className="inline-flex items-center rounded-full bg-white/15 px-3 py-1 text-[11px] font-semibold tracking-[0.14em] text-white/90 uppercase ring-1 ring-inset ring-white/20">
          Exam prep, refined
        </span>
        <h1 className="font-heading text-4xl leading-[1.1] font-extrabold tracking-tight text-white text-balance">
          Practice sharper.
          <br />
          Score higher.
        </h1>
        <p className="text-sm leading-relaxed text-white/85">
          Ace Mock turns your study material into targeted mock tests and
          performance insights — so every session moves the needle.
        </p>

        <ul className="space-y-3.5 pt-2">
          {HIGHLIGHTS.map((item) => (
            <li key={item.title} className="flex gap-3">
              <span className="mt-1 flex size-5 shrink-0 items-center justify-center rounded-full bg-white/15 ring-1 ring-inset ring-white/25">
                <span className="size-1.5 rounded-full bg-white" />
              </span>
              <div>
                <p className="text-sm font-semibold text-white">{item.title}</p>
                <p className="text-xs leading-relaxed text-white/80">
                  {item.description}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </div>

      {/* Footer */}
      <p className="relative z-10 text-xs text-white/70">
        Trusted by serious aspirants preparing for competitive exams.
      </p>
    </aside>
  );
}
