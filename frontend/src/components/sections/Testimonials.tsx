const TESTIMONIALS = [
  {
    text: "Teachwise helped me ace my calculus exams after just three sessions. My tutor explained things I\u2019d been stuck on for months in a completely new way.",
    name: "Sarah M.",
    role: "STEM Student, UCLA",
    initial: "S",
    gradient: "from-accent-3 to-accent",
  },
  {
    text: "My daughter\u2019s grades improved dramatically after just a few sessions. The tutors are incredibly patient and know exactly how to keep kids engaged.",
    name: "David K.",
    role: "Parent, San Francisco",
    initial: "D",
    gradient: "from-accent to-accent-2",
  },
  {
    text: "The interactive classroom is unreal. Whiteboard, video, code editor \u2014 all in one place. It\u2019s like being in a real class but better.",
    name: "James L.",
    role: "CS Major, UC Berkeley",
    initial: "J",
    gradient: "from-accent-3 to-[#ff8c00]",
  },
  {
    text: "Found a perfect Spanish tutor in minutes. We\u2019ve been meeting twice a week for 3 months and I\u2019m now conversational. Absolutely worth it.",
    name: "Maya R.",
    role: "Professional, New York",
    initial: "M",
    gradient: "from-accent-2 to-[#7c3aed]",
  },
] as const;

export default function Testimonials() {
  return (
    <section className="relative z-[1] py-section-py px-section-px max-md:py-20 max-md:px-6">
      {/* Header */}
      <div className="text-center mb-16">
        <span className="inline-block text-section-label text-accent uppercase mb-3">
          Social Proof
        </span>
        <h2 className="font-head text-section-title font-bold text-[var(--text)]">
          What students say
        </h2>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-2 max-md:grid-cols-1 gap-6 max-w-testimonials mx-auto">
        {TESTIMONIALS.map((t) => (
          <div
            key={t.name}
            className="relative bg-[var(--surface)] light:bg-white border border-[var(--border)] rounded-card p-9"
          >
            {/* Decorative quote */}
            <span className="absolute top-5 right-7 text-[5rem] text-[rgba(79,142,255,0.1)] font-head leading-none select-none">
              &ldquo;
            </span>

            <p className="text-[var(--text)] text-base leading-[1.7] italic mb-6 font-light">
              {t.text}
            </p>

            <div className="flex items-center gap-3">
              <div
                className={`w-[42px] h-[42px] rounded-full bg-gradient-to-br ${t.gradient} flex items-center justify-center font-bold text-[14px] text-white flex-shrink-0`}
              >
                {t.initial}
              </div>
              <div>
                <div className="text-[#ffd700] text-[0.8rem] tracking-[2px] mb-[2px]">
                  ★★★★★
                </div>
                <div className="font-semibold text-[0.9rem]">{t.name}</div>
                <div className="text-[var(--muted)] text-[0.78rem]">
                  {t.role}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
