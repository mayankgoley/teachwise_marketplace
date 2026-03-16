"use client";

import Link from "next/link";
import { useTheme } from "@/context/ThemeContext";
import { useAuth } from "@/context/AuthContext";
import { dashboardPath } from "@/lib/auth-utils";
import { Moon, Sun } from "lucide-react";

const NAV_LINKS = [
  { label: "Home", href: "/" },
  { label: "Find Tutors", href: "/search" },
  { label: "Categories", href: "/categories" },
  { label: "How It Works", href: "/#how-it-works" },
] as const;

export default function NavBar() {
  const { theme, toggleTheme } = useTheme();
  const { user } = useAuth();

  return (
    <nav className="fixed top-0 left-0 right-0 z-[100] flex items-center justify-between px-section-px h-nav-h bg-[rgba(3,4,10,0.7)] light:bg-[rgba(244,246,251,0.85)] backdrop-blur-[24px] border-b border-[var(--border)]">
      {/* Logo */}
      <Link
        href="/"
        className="flex items-center gap-[10px] font-head text-[1.3rem] font-[800] text-[var(--text)] no-underline"
      >
        <div className="w-8 h-8 btn-gradient rounded-lg flex items-center justify-center text-base">
          🎓
        </div>
        Teachwise
      </Link>

      {/* Links */}
      <ul className="hidden md:flex items-center gap-8 list-none">
        {NAV_LINKS.map((link) => (
          <li key={link.href}>
            <Link
              href={link.href}
              className="text-[var(--muted)] no-underline text-[0.9rem] font-medium tracking-[0.02em] transition-colors duration-200 hover:text-[var(--text)]"
            >
              {link.label}
            </Link>
          </li>
        ))}
      </ul>

      <div className="flex items-center gap-3">
        {/* Auth-aware CTA */}
        {user ? (
          <Link
            href={dashboardPath(user.user_type)}
            className="btn-gradient text-white border-none py-[10px] px-6 rounded-pill font-body font-semibold text-[0.9rem] shadow-glow-sm transition-[opacity,box-shadow] duration-200 hover:opacity-90 hover:shadow-glow no-underline"
          >
            Dashboard &rarr;
          </Link>
        ) : (
          <>
            <Link
              href="/login"
              className="text-[var(--muted)] no-underline text-[0.9rem] font-medium transition-colors duration-200 hover:text-[var(--text)] hidden sm:inline"
            >
              Sign In
            </Link>
            <Link
              href="/signup"
              className="btn-gradient text-white border-none py-[10px] px-6 rounded-pill font-body font-semibold text-[0.9rem] shadow-glow-sm transition-[opacity,box-shadow] duration-200 hover:opacity-90 hover:shadow-glow no-underline"
            >
              Sign Up Free
            </Link>
          </>
        )}

        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          title="Toggle theme"
          aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          className="w-[38px] h-[38px] rounded-full flex items-center justify-center text-[17px] bg-[rgba(255,255,255,0.08)] border border-[var(--border)] text-[var(--text)] transition-[background,transform] duration-200 hover:bg-[rgba(79,142,255,0.15)] hover:rotate-[20deg] flex-shrink-0"
        >
          {theme === "dark" ? <Moon size={20} strokeWidth={1.5} /> : <Sun size={20} strokeWidth={1.5} />}
        </button>
      </div>
    </nav>
  );
}
