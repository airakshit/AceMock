interface AuthPanelBackdropProps {
  /** Prefix for the SVG gradient id so repeated instances never collide. */
  idPrefix?: string;
}

/**
 * AuthPanelBackdrop — the shared editorial backdrop behind auth surfaces.
 *
 * Blueprint grid, ambient emerald orbs, and the exponential-curve
 * watermark. Rendered by the desktop brand panel and reused verbatim as
 * the small-screen auth background, so both stay pixel-identical.
 */
export function AuthPanelBackdrop({ idPrefix = "auth" }: AuthPanelBackdropProps) {
  const gradientId = `${idPrefix}-watermark-glow`;

  return (
    <>
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
          <linearGradient id={gradientId} x1="0%" y1="100%" x2="100%" y2="0%">
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
          stroke={`url(#${gradientId})`}
          strokeWidth="3.5"
          strokeLinecap="round"
        />
        <path
          d="M 120 840 C 300 838 480 810 590 680 C 660 590 710 470 760 300"
          stroke={`url(#${gradientId})`}
          strokeWidth="2"
          strokeDasharray="4 6"
          opacity="0.6"
        />
      </svg>
    </>
  );
}
