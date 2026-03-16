import Link from "next/link";

export default function CTABanner() {
  return (
    <section className="relative z-[1] py-[100px] px-section-px pb-section-py text-center max-md:py-20 max-md:px-6">
      <div className="relative overflow-hidden max-w-cta mx-auto bg-[linear-gradient(135deg,rgba(79,142,255,0.08),rgba(0,229,255,0.05),rgba(255,79,216,0.05))] border border-[rgba(79,142,255,0.2)] rounded-card-xl py-20 px-[60px] max-md:py-12 max-md:px-8">
        {/* Top edge gradient line */}
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-accent via-accent-2 to-transparent" />

        <h2 className="font-head text-section-title font-[800] mb-4 tracking-[-0.025em]">
          Ready to Start Learning?
        </h2>
        <p className="text-[var(--muted)] text-base mb-10 font-light">
          Join 24,000+ students already unlocking their potential on Teachwise.
        </p>

        <div className="flex gap-4 justify-center flex-wrap">
          <Link
            href="/search"
            className="relative overflow-hidden btn-gradient text-white border-none py-[18px] px-11 rounded-pill font-body font-semibold text-[1.1rem] shadow-glow transition-[box-shadow,transform] duration-300 hover:shadow-glow-lg hover:-translate-y-0.5 no-underline"
          >
            Find a Tutor Now →
          </Link>
          <Link
            href="/register-tutor"
            className="bg-transparent text-[var(--text)] border border-[rgba(255,255,255,0.15)] py-[18px] px-11 rounded-pill font-body font-medium text-[1.1rem] backdrop-blur-[8px] transition-[border-color,background,transform] duration-200 hover:border-accent hover:bg-[rgba(79,142,255,0.08)] hover:-translate-y-0.5 no-underline"
          >
            Become a Tutor
          </Link>
        </div>
      </div>
    </section>
  );
}
