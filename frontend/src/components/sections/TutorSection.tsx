import Link from "next/link";
import { Star } from "lucide-react";
import type { ReactNode } from "react";

interface TutorCard {
  initial: string;
  name: string;
  subject: string;
  rating: ReactNode;
  experience: string;
  rate: string;
  gradient: string;
}

const PLACEHOLDER_TUTORS: TutorCard[] = [
  {
    initial: "A",
    name: "Alex Chen",
    subject: "Mathematics & Physics",
    rating: <><Star size={14} strokeWidth={1.5} fill="currentColor" /> 4.9</>,
    experience: "8 yrs exp",
    rate: "$45/hr",
    gradient: "from-accent to-accent-3",
  },
  {
    initial: "S",
    name: "Sarah Park",
    subject: "Coding & Web Dev",
    rating: <><Star size={14} strokeWidth={1.5} fill="currentColor" /> 5.0</>,
    experience: "5 yrs exp",
    rate: "$60/hr",
    gradient: "from-accent-3 to-accent",
  },
  {
    initial: "M",
    name: "Marcus Webb",
    subject: "Biology & Chemistry",
    rating: <><Star size={14} strokeWidth={1.5} fill="currentColor" /> 4.8</>,
    experience: "12 yrs exp",
    rate: "$55/hr",
    gradient: "from-accent-2 to-[#1a5c1a]",
  },
];

function TutorCardComponent({ tutor }: { tutor: TutorCard }) {
  return (
    <div className="group relative overflow-hidden bg-[var(--surface)] light:bg-white border border-[var(--border)] rounded-card py-8 px-6 transition-[border-color,transform] duration-300 hover:border-[rgba(79,142,255,0.4)] hover:-translate-y-[6px]">
      {/* Bottom gradient line on hover */}
      <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-gradient-to-r from-accent via-accent-2 to-accent-3 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

      {/* Avatar */}
      <div
        className={`w-[72px] h-[72px] rounded-full mx-auto mb-4 bg-gradient-to-br ${tutor.gradient} flex items-center justify-center text-[28px] text-white font-bold border-2 border-[rgba(79,142,255,0.3)]`}
      >
        {tutor.initial}
      </div>

      <div className="font-head text-[1.1rem] font-bold mb-1 text-center">
        {tutor.name}
      </div>
      <div className="text-accent-2 text-[0.8rem] font-semibold uppercase tracking-[0.08em] mb-3 text-center">
        {tutor.subject}
      </div>

      {/* Tags */}
      <div className="flex gap-3 justify-center flex-wrap">
        {[tutor.rating, tutor.experience, tutor.rate].map((tag, idx) => (
          <span
            key={idx}
            className="bg-[rgba(255,255,255,0.06)] light:bg-[rgba(0,0,0,0.05)] border border-[var(--border)] rounded-pill py-1 px-3 text-[0.75rem] text-[var(--muted)] inline-flex items-center gap-1"
          >
            {tag}
          </span>
        ))}
      </div>
    </div>
  );
}

export default function TutorSection() {
  const tutors = PLACEHOLDER_TUTORS;

  return (
    <section className="relative z-[1] py-section-py px-section-px text-center max-md:py-20 max-md:px-6">
      <span className="inline-block text-section-label text-accent uppercase mb-3">
        Our Team
      </span>
      <h2 className="font-head text-section-title font-bold text-[var(--text)] mb-4">
        Meet Top Tutors
      </h2>
      <p className="text-[var(--muted)] text-base font-light max-w-[400px] mx-auto">
        Real humans. Real experts. Real results.
      </p>

      <div className="grid grid-cols-3 max-md:grid-cols-1 gap-6 max-w-tutors mx-auto mt-14">
        {tutors.map((tutor) => (
          <TutorCardComponent key={tutor.name} tutor={tutor} />
        ))}
      </div>

      <div className="mt-10">
        <Link
          href="/search"
          className="text-accent text-[0.9rem] font-medium hover:underline"
        >
          View All Tutors →
        </Link>
      </div>
    </section>
  );
}
