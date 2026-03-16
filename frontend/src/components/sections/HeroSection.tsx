import HeroCTA from "./HeroCTA";

const STATS = [
  { value: "24K+", label: "Students Helped" },
  { value: "2,400", label: "Expert Tutors" },
  { value: "850+", label: "Topics Covered" },
  { value: "4.9\u2605", label: "Avg. Rating" },
] as const;

export default function HeroSection() {
  return (
    <section className="relative z-[1] min-h-screen flex items-center justify-center flex-col text-center px-section-px pt-[120px] pb-[80px] overflow-hidden">
      {/* Badge */}
      <div className="inline-flex items-center gap-2 bg-[rgba(79,142,255,0.1)] border border-[rgba(79,142,255,0.3)] text-accent-2 text-[0.78rem] font-semibold tracking-[0.12em] uppercase py-[6px] px-4 rounded-pill mb-8 animate-fade-up">
        <span className="w-[6px] h-[6px] rounded-full bg-accent-2 animate-pulse" />
        Now live &middot; 2,400+ expert tutors
      </div>

      {/* Title */}
      <h1 className="font-head text-hero-title font-bold mb-7 animate-fade-up-1">
        <span className="block text-[var(--text)]">Unlock Your</span>
        <span className="block text-gradient animate-shimmer">Potential.</span>
      </h1>

      {/* Subtitle */}
      <p className="max-w-hero-sub text-[var(--muted)] text-[1.1rem] font-light mb-12 animate-fade-up-2">
        Connect with world-class tutors, master any subject, and accelerate your
        academic journey — on your schedule.
      </p>

      {/* Actions — role-aware when logged in */}
      <HeroCTA />

      {/* Stats */}
      <div className="flex gap-12 mt-[72px] animate-fade-up-4 max-md:gap-6">
        {STATS.map((stat, i) => (
          <div key={stat.label} className="contents">
            {i > 0 && (
              <div className="w-px bg-[var(--border)] light:bg-[rgba(0,0,0,0.12)]" />
            )}
            <div className="text-center">
              <div className="font-head text-stat-num text-gradient-stat">
                {stat.value}
              </div>
              <div className="text-[0.8rem] text-[var(--muted)] uppercase tracking-[0.08em]">
                {stat.label}
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
