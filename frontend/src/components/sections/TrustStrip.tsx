import { Lock, CheckCircle, Shield, CreditCard, Star, GraduationCap } from "lucide-react";
import type { ReactNode } from "react";

const BADGES: { icon: ReactNode; text: string }[] = [
  { icon: <Lock size={16} strokeWidth={1.5} />, text: "SSL Secured" },
  { icon: <CheckCircle size={16} strokeWidth={1.5} />, text: "Background-Checked Tutors" },
  { icon: <Shield size={16} strokeWidth={1.5} />, text: "COPPA Compliant" },
  { icon: <CreditCard size={16} strokeWidth={1.5} />, text: "Secure Payments via Stripe" },
  { icon: <Star size={16} strokeWidth={1.5} />, text: "4.9 / 5 Average Rating" },
  { icon: <GraduationCap size={16} strokeWidth={1.5} />, text: "24,000+ Students Helped" },
];

export default function TrustStrip() {
  return (
    <div className="relative z-[1] border-y border-[var(--border)] py-7 px-section-px flex items-center justify-center gap-3 flex-wrap bg-[rgba(255,255,255,0.02)] light:bg-[rgba(0,0,0,0.02)]">
      <span className="text-[0.75rem] text-[var(--muted)] tracking-[0.1em] uppercase mr-2 whitespace-nowrap">
        Trusted by
      </span>

      {BADGES.map((badge, i) => (
        <div key={badge.text} className="contents">
          {i > 0 && (
            <div className="w-px h-5 bg-[var(--border)]" />
          )}
          <div className="flex items-center gap-[7px] bg-[rgba(255,255,255,0.05)] light:bg-[rgba(0,0,0,0.04)] border border-[var(--border)] rounded-pill py-[7px] px-4 text-[0.82rem] font-medium text-[var(--text)] whitespace-nowrap">
            <span className="text-[14px]">{badge.icon}</span>
            {badge.text}
          </div>
        </div>
      ))}
    </div>
  );
}
