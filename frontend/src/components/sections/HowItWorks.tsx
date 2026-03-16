import { Search, Handshake, Trophy } from "lucide-react";
import type { ReactNode } from "react";

const STEPS: { num: string; icon: ReactNode; title: string; desc: string }[] = [
  {
    num: "01",
    icon: <Search size={28} strokeWidth={1.5} />,
    title: "Search & Discover",
    desc: "Filter by subject, availability, price, and ratings. Find the tutor that fits your learning style perfectly.",
  },
  {
    num: "02",
    icon: <Handshake size={28} strokeWidth={1.5} />,
    title: "Connect Instantly",
    desc: "Book a session in seconds. Meet in our interactive virtual classroom with whiteboard, video, and real-time tools.",
  },
  {
    num: "03",
    icon: <Trophy size={28} strokeWidth={1.5} />,
    title: "Learn & Grow",
    desc: "Achieve your goals with personalized guidance, progress tracking, and on-demand session recordings.",
  },
];

export default function HowItWorks() {
  return (
    <section
      id="how-it-works"
      className="relative z-[1] py-section-py px-section-px flex flex-col items-center gap-20 max-md:py-20 max-md:px-6"
    >
      {/* Header */}
      <div className="text-center">
        <span className="inline-block text-section-label text-accent uppercase mb-3">
          Process
        </span>
        <h2 className="font-head text-section-title font-bold text-[var(--text)] mb-4">
          How Teachwise Works
        </h2>
        <p className="text-[var(--muted)] text-base font-light max-w-[480px]">
          Three simple steps between you and your breakthrough moment.
        </p>
      </div>

      {/* Steps grid */}
      <div className="grid grid-cols-3 max-md:grid-cols-1 gap-[2px] max-w-[1100px] w-full bg-[var(--border)] border border-[var(--border)] rounded-card-lg overflow-hidden">
        {STEPS.map((step) => (
          <div
            key={step.num}
            className="group relative overflow-hidden bg-[var(--surface)] light:bg-white py-12 px-10 transition-colors duration-300 hover:bg-[var(--surface2)]"
          >
            {/* Hover glow overlay */}
            <div className="absolute inset-0 bg-gradient-to-br from-[var(--glow)] to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

            {/* Ghost number */}
            <span className="absolute top-4 right-6 font-head text-[5rem] font-[800] text-[rgba(255,255,255,0.04)] leading-none select-none">
              {step.num}
            </span>

            {/* Icon */}
            <div className="relative z-[1] w-[52px] h-[52px] rounded-icon flex items-center justify-center text-2xl mb-6 bg-[linear-gradient(135deg,rgba(79,142,255,0.15),rgba(0,229,255,0.1))] border border-[rgba(79,142,255,0.25)]">
              {step.icon}
            </div>

            {/* Text */}
            <div className="relative z-[1] font-head text-[1.25rem] font-bold text-[var(--text)] mb-[10px]">
              {step.title}
            </div>
            <p className="relative z-[1] text-[var(--muted)] text-[0.9rem] leading-[1.7]">
              {step.desc}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
