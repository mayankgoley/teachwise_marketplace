import Link from "next/link";
import { Star, Calendar, Monitor, DollarSign, Target, Video } from "lucide-react";
import type { ReactNode } from "react";

const FEATURES: { icon: ReactNode; title: string; desc: string; iconClass: string }[] = [
  {
    icon: <Star size={28} strokeWidth={1.5} />,
    title: "Vetted Expert Tutors",
    desc: "Every tutor is background-checked, credential-verified, and rated by real students.",
    iconClass: "bg-[linear-gradient(135deg,rgba(79,142,255,0.2),rgba(0,229,255,0.1))] border-[rgba(79,142,255,0.3)]",
  },
  {
    icon: <Calendar size={28} strokeWidth={1.5} />,
    title: "Flexible Scheduling",
    desc: "Book any time, from any timezone. Cancel or reschedule up to 2 hours before.",
    iconClass: "bg-[linear-gradient(135deg,rgba(255,79,216,0.2),rgba(255,150,0,0.1))] border-[rgba(255,79,216,0.3)]",
  },
  {
    icon: <Monitor size={28} strokeWidth={1.5} />,
    title: "Interactive Classroom",
    desc: "Whiteboard, code editor, video, chat — everything you need in one seamless space.",
    iconClass: "bg-[linear-gradient(135deg,rgba(0,229,255,0.2),rgba(79,142,255,0.1))] border-[rgba(0,229,255,0.3)]",
  },
  {
    icon: <DollarSign size={28} strokeWidth={1.5} />,
    title: "Transparent Pricing",
    desc: "No hidden fees, no subscriptions required. Pay only for the sessions you book.",
    iconClass: "bg-[linear-gradient(135deg,rgba(100,255,100,0.15),rgba(0,200,100,0.1))] border-[rgba(0,200,100,0.3)]",
  },
  {
    icon: <Target size={28} strokeWidth={1.5} />,
    title: "Personalized Learning Paths",
    desc: "AI-powered recommendations that match your goals, pace, and learning style.",
    iconClass: "bg-[linear-gradient(135deg,rgba(255,200,0,0.2),rgba(255,100,0,0.1))] border-[rgba(255,200,0,0.3)]",
  },
  {
    icon: <Video size={28} strokeWidth={1.5} />,
    title: "Session Recordings",
    desc: "Every session recorded automatically. Revisit key moments whenever you need.",
    iconClass: "bg-[linear-gradient(135deg,rgba(200,100,255,0.2),rgba(100,0,255,0.1))] border-[rgba(200,100,255,0.3)]",
  },
];

export default function FeatureGrid() {
  return (
    <section className="relative z-[1] pb-section-py max-md:pb-20">
      <div className="flex gap-20 items-center max-w-content mx-auto px-section-px max-md:flex-col max-md:px-6">
        {/* Left column */}
        <div className="flex-1">
          <span className="inline-block text-section-label text-accent uppercase mb-3">
            Why Teachwise
          </span>
          <h2 className="font-head text-section-title font-bold text-[var(--text)] mb-4">
            Built for the way you learn
          </h2>
          <p className="text-[var(--muted)] text-base font-light max-w-[480px] mb-8">
            Every feature designed around your success — not just another video
            call platform.
          </p>
          <Link
            href="/features"
            className="relative overflow-hidden btn-gradient text-white border-none py-4 px-9 rounded-pill font-body font-semibold text-base shadow-glow transition-[box-shadow,transform] duration-300 hover:shadow-glow-lg hover:-translate-y-0.5 no-underline inline-block"
          >
            Explore All Features
          </Link>
        </div>

        {/* Right column — feature cards */}
        <div className="flex-1 flex flex-col gap-4">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="bg-[var(--surface)] light:bg-white border border-[var(--border)] rounded-[16px] p-6 flex gap-5 items-start transition-[border-color,background] duration-300 hover:border-[rgba(79,142,255,0.4)] hover:bg-[rgba(79,142,255,0.05)]"
            >
              <div
                className={`w-11 h-11 rounded-[12px] flex-shrink-0 flex items-center justify-center text-xl border ${f.iconClass}`}
              >
                {f.icon}
              </div>
              <div>
                <div className="font-head text-base font-bold mb-1">
                  {f.title}
                </div>
                <div className="text-[var(--muted)] text-[0.875rem] leading-[1.6]">
                  {f.desc}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
