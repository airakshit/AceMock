import { BrandLogo } from "@/components/icons/brand-logo";

const STATS = [
  { value: "3,000+", label: "Practice Questions" },
  { value: "10+", label: "IOE Model Sets" },
  { value: "2.7x", label: "Score Acceleration" },
];

/**
 * AuthBrandPanel — the editorial hero shown beside the auth forms on large screens.
 * Perfectly calibrated with the emerald green sidebar and features the e^x exponential logo.
 * Designed to fit entirely within a single viewport — no scroll.
 */
export function AuthBrandPanel() {
  return (
    <aside className="relative hidden overflow-hidden bg-brand-gradient lg:flex lg:flex-col lg:justify-between lg:p-8 xl:p-10">
      {/* Dynamic Background Elements: Blueprint Grid & Ambient Emerald Aura */}
      <div className="pointer-events-none absolute inset-0 bg-grid-fade opacity-30" />
      
      {/* Ambient glowing orbs */}
      <div className="pointer-events-none absolute -top-28 -left-28 size-[420px] rounded-full bg-emerald-400/20 blur-[100px]" />
      <div className="pointer-events-none absolute top-1/2 -right-24 size-[380px] -translate-y-1/2 rounded-full bg-emerald-300/15 blur-[90px]" />
      <div className="pointer-events-none absolute -bottom-32 left-1/4 size-[400px] rounded-full bg-emerald-950/40 blur-[80px]" />

      {/* Decorative Exponential Function Curves (Watermark Art) */}
      <svg
        className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.14] stroke-white"
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 800 1000"
        fill="none"
        preserveAspectRatio="xMidYMid slice"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="auth-watermark-glow" x1="0%" y1="100%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#059669" stopOpacity="0.1" />
            <stop offset="50%" stopColor="#34D399" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#FFFFFF" stopOpacity="1" />
          </linearGradient>
        </defs>

        {/* Coordinate Grid lines */}
        <g strokeDasharray="6 8" strokeWidth="1.5">
          <line x1="80" y1="200" x2="720" y2="200" />
          <line x1="80" y1="400" x2="720" y2="400" />
          <line x1="80" y1="600" x2="720" y2="600" />
          <line x1="80" y1="800" x2="720" y2="800" />
          <line x1="200" y1="100" x2="200" y2="900" />
          <line x1="400" y1="100" x2="400" y2="900" />
          <line x1="600" y1="100" x2="600" y2="900" />
        </g>

        {/* Sweeping Exponential Growth Trajectories: y = e^x */}
        <path
          d="M 60 820 C 240 815 420 780 540 600 C 620 480 680 320 740 120"
          stroke="url(#auth-watermark-glow)"
          strokeWidth="3.5"
          strokeLinecap="round"
        />
        <path
          d="M 120 840 C 300 838 480 810 590 680 C 660 590 710 470 760 300"
          stroke="url(#auth-watermark-glow)"
          strokeWidth="2"
          strokeDasharray="4 6"
          opacity="0.6"
        />
      </svg>

      {/* Top Header: Brand Logo */}
      <div className="relative z-10">
        <BrandLogo
          variant="full"
          size="lg"
          tone="onDark"
          subtitle="Exam Prep Platform"
          className="transition-transform duration-200 hover:scale-[1.02]"
        />
      </div>

      {/* Center Body: Headline & Editorial Copy */}
      <div className="relative z-10 flex flex-1 flex-col justify-center pb-14 pt-2">
        <div className="max-w-lg space-y-3.5">
          <h1 className="font-heading text-3xl leading-[1.12] font-black tracking-tight text-white text-balance xl:text-4xl">
            Practice sharper.
            <br />
            <span className="bg-gradient-to-r from-white via-emerald-100 to-emerald-300 bg-clip-text text-transparent">
              Score exponentially.
            </span>
          </h1>
          <p className="max-w-md text-sm leading-relaxed text-white/85">
            Turn your study time into compound mastery with high-yield IOE mock tests,
            instant diagnostics, and continuous score acceleration.
          </p>
        </div>
      </div>

      {/* Footer: Trust Stats */}
      <div className="relative z-10 border-t border-white/20 pt-5">
        <div className="grid grid-cols-3 gap-6">
          {STATS.map((stat) => (
            <div key={stat.label} className="space-y-0.5">
              <p className="font-heading text-2xl font-extrabold tracking-tight text-white tabular-nums">
                {stat.value}
              </p>
              <p className="text-[10px] font-semibold tracking-[0.12em] text-emerald-100/80 uppercase">
                {stat.label}
              </p>
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
}
