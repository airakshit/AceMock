import { BrandLogo } from "@/components/icons/brand-logo";
import { AuthPanelBackdrop } from "@/components/layouts/components/auth-panel-backdrop";

const STATS = [
  { value: "3,000+", label: "Practice Questions" },
  { value: "10+", label: "IOE Model Sets" },
  { value: "2.7x", label: "Score Acceleration" },
];

/**
 * AuthBrandPanel — the emerald brand canvas behind the auth experience.
 *
 * Large screens: the editorial hero beside the form (logo, headline, trust
 * stats), calibrated with the sidebar green and the e^x mark. Fits a single
 * viewport — no scroll.
 *
 * Small screens: the exact same gradient + backdrop collapse into a
 * full-bleed background layer behind the form column; the editorial copy is
 * hidden, so only the form column's own top-left lockup and bottom tagline
 * read over it.
 */
export function AuthBrandPanel() {
  return (
    <aside className="absolute inset-0 overflow-hidden bg-brand-gradient lg:relative lg:flex lg:flex-col lg:justify-between lg:p-8 xl:p-10">
      <AuthPanelBackdrop />

      {/* Top Header: Brand Logo */}
      <div className="hidden relative z-10 lg:block">
        <BrandLogo
          variant="full"
          size="lg"
          tone="onBrand"
          subtitle="Exam Prep Platform"
          className="transition-transform duration-200 hover:scale-[1.02]"
        />
      </div>

      {/* Center Body: Headline & Editorial Copy */}
      <div className="hidden relative z-10 flex-1 flex-col justify-center pb-14 pt-2 lg:flex">
        <div className="max-w-lg space-y-3.5">
          <h1 className="font-heading text-3xl leading-[1.12] font-black tracking-tight text-sidebar-foreground text-balance xl:text-4xl">
            Practice sharper.
            <br />
            <span className="bg-gradient-to-r from-sidebar-foreground via-emerald-100 to-emerald-300 bg-clip-text text-transparent">
              Score exponentially.
            </span>
          </h1>
          <p className="max-w-md text-sm leading-relaxed text-sidebar-foreground/85">
            Turn your study time into compound mastery with high-yield IOE mock tests,
            instant diagnostics, and continuous score acceleration.
          </p>
        </div>
      </div>

      {/* Footer: Trust Stats */}
      <div className="hidden relative z-10 border-t border-sidebar-border pt-5 lg:block">
        <div className="grid grid-cols-3 gap-6">
          {STATS.map((stat) => (
            <div key={stat.label} className="space-y-0.5">
              <p className="font-heading text-2xl font-extrabold tracking-tight text-sidebar-foreground tabular-nums">
                {stat.value}
              </p>
              <p className="text-[10px] font-semibold tracking-[0.12em] text-sidebar-foreground/70 uppercase">
                {stat.label}
              </p>
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
}
