import Link from "next/link";
import { Gamepad2, Compass, Plane, Leaf, Calendar, Scale, Monitor, FlaskConical } from "lucide-react";
import type { ReactNode } from "react";

const CATEGORIES: { icon: ReactNode; name: string; count: string; gradient: string }[] = [
  { icon: <Gamepad2 size={24} strokeWidth={1.5} />, name: "Games & Strategy", count: "24 topics", gradient: "from-cat-1-from to-cat-1-to" },
  { icon: <Compass size={24} strokeWidth={1.5} />, name: "Philosophy & Spirituality", count: "22 topics", gradient: "from-cat-2-from to-cat-2-to" },
  { icon: <Plane size={24} strokeWidth={1.5} />, name: "Aviation & Nautical", count: "11 topics", gradient: "from-cat-3-from to-cat-3-to" },
  { icon: <Leaf size={24} strokeWidth={1.5} />, name: "Environmental Science", count: "15 topics", gradient: "from-cat-4-from to-cat-4-to" },
  { icon: <Calendar size={24} strokeWidth={1.5} />, name: "Event Planning", count: "12 topics", gradient: "from-cat-5-from to-cat-5-to" },
  { icon: <Scale size={24} strokeWidth={1.5} />, name: "Legal Studies", count: "9 topics", gradient: "from-cat-6-from to-cat-6-to" },
  { icon: <Monitor size={24} strokeWidth={1.5} />, name: "Technology", count: "48 topics", gradient: "from-cat-7-from to-cat-7-to" },
  { icon: <FlaskConical size={24} strokeWidth={1.5} />, name: "Sciences", count: "36 topics", gradient: "from-cat-8-from to-cat-8-to" },
];

export default function CategoryScroll() {
  return (
    <section className="relative z-[1] py-section-py px-section-px max-md:py-20 max-md:px-6">
      {/* Header */}
      <div className="mb-14">
        <span className="inline-block text-section-label text-accent uppercase mb-3">
          Explore
        </span>
        <h2 className="font-head text-section-title font-bold text-[var(--text)] mb-4">
          Browse Categories
        </h2>
        <p className="text-[var(--muted)] text-base font-light max-w-[480px]">
          Find tutors across 24 categories and 850+ topics
        </p>
      </div>

      {/* Horizontal scroll */}
      <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-none">
        {CATEGORIES.map((cat) => (
          <Link
            key={cat.name}
            href={`/categories/${encodeURIComponent(cat.name.toLowerCase().replace(/\s+&\s+/g, "-").replace(/\s+/g, "-"))}`}
            className={`flex-shrink-0 w-[200px] h-[220px] rounded-card p-7 pb-7 flex flex-col justify-end relative overflow-hidden transition-[transform,box-shadow] duration-300 border border-transparent hover:-translate-y-2 hover:scale-[1.02] bg-gradient-to-br ${cat.gradient} no-underline`}
          >
            <div className="text-[2.2rem] mb-3 relative z-[1]">{cat.icon}</div>
            <div className="font-head text-base font-bold text-white relative z-[1]">
              {cat.name}
            </div>
            <div className="text-[0.78rem] text-[rgba(255,255,255,0.65)] relative z-[1] mt-1">
              {cat.count}
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
