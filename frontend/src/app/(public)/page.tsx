import StarCanvas from "@/components/ui/StarCanvas";
import LoadingScreen from "@/components/ui/LoadingScreen";
import NavBar from "@/components/layout/NavBar";
import HeroSection from "@/components/sections/HeroSection";
import TrustStrip from "@/components/sections/TrustStrip";
import HowItWorks from "@/components/sections/HowItWorks";
import CategoryScroll from "@/components/sections/CategoryScroll";
import FeatureGrid from "@/components/sections/FeatureGrid";
import TutorSection from "@/components/sections/TutorSection";
import Testimonials from "@/components/sections/Testimonials";
import CTABanner from "@/components/sections/CTABanner";
import ChatBot from "@/components/features/ChatBot";
import Link from "next/link";

const FOOTER_LINKS = [
  { label: "Privacy", href: "/privacy" },
  { label: "Terms", href: "/terms" },
  { label: "Support", href: "/support" },
  { label: "Careers", href: "/careers" },
] as const;

export default function HomePage() {
  return (
    <>
      <LoadingScreen />

      {/* Background layers */}
      <StarCanvas />

      {/* Scanline */}
      <div
        className="fixed top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-accent-2 to-transparent opacity-40 pointer-events-none z-[200] animate-scan"
        aria-hidden="true"
      />

      {/* Aurora orbs */}
      <div
        className="fixed rounded-full pointer-events-none z-0 opacity-[0.35] light:opacity-[0.18] animate-drift w-[600px] h-[600px] -top-[200px] -left-[100px]"
        style={{
          background: "radial-gradient(circle, #4f8eff, transparent 70%)",
          filter: "blur(120px)",
        }}
        aria-hidden="true"
      />
      <div
        className="fixed rounded-full pointer-events-none z-0 opacity-[0.35] light:opacity-[0.18] animate-drift w-[500px] h-[500px] -bottom-[100px] -right-[100px]"
        style={{
          background: "radial-gradient(circle, #ff4fd8, transparent 70%)",
          filter: "blur(120px)",
          animationDelay: "-7s",
        }}
        aria-hidden="true"
      />
      <div
        className="fixed rounded-full pointer-events-none z-0 opacity-[0.15] light:opacity-[0.18] animate-drift w-[400px] h-[400px] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
        style={{
          background: "radial-gradient(circle, #00e5ff, transparent 70%)",
          filter: "blur(120px)",
          animationDelay: "-14s",
        }}
        aria-hidden="true"
      />

      {/* Navigation */}
      <NavBar />

      {/* Page sections */}
      <main id="main-content">
      <HeroSection />
      <TrustStrip />
      <HowItWorks />
      <CategoryScroll />
      <FeatureGrid />
      <TutorSection />
      <Testimonials />
      <CTABanner />
      </main>

      {/* Footer */}
      <footer className="relative z-[1] border-t border-[var(--border)] py-8 px-section-px flex justify-between items-center max-md:flex-col max-md:gap-4 max-md:text-center">
        <div className="font-head font-[800] text-[1.1rem] text-[var(--text)]">
          🎓 Teachwise
        </div>
        <ul className="flex gap-6 list-none">
          {FOOTER_LINKS.map((link) => (
            <li key={link.href}>
              <Link
                href={link.href}
                className="text-[var(--muted)] no-underline text-[0.85rem] transition-colors duration-200 hover:text-[var(--text)]"
              >
                {link.label}
              </Link>
            </li>
          ))}
        </ul>
        <div className="text-[var(--muted)] text-[0.8rem]">
          &copy; 2026 Teachwise. All rights reserved.
        </div>
      </footer>

      {/* Chatbot */}
      <ChatBot />
    </>
  );
}
