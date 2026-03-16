import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      /* ── Fonts (from redesign HTML) ─────────────────────────────── */
      fontFamily: {
        head: ["'Cormorant Garamond'", "serif"],
        body: ["'DM Sans'", "sans-serif"],
      },

      /* ── Colors ────────────────────────────────────────────────── */
      colors: {
        // Core palette — dark mode defaults
        bg: {
          DEFAULT: "#03040a",
          light: "#f4f6fb",
        },
        surface: {
          DEFAULT: "#0b0d18",
          light: "#ffffff",
          "2": "rgba(16,20,34,0.5)",
          "2-light": "rgba(255,255,255,0.85)",
        },
        border: {
          DEFAULT: "rgba(255,255,255,0.07)",
          light: "rgba(0,0,0,0.09)",
        },
        accent: {
          DEFAULT: "#4f8eff",
          2: "#00e5ff",
          3: "#ff4fd8",
        },
        text: {
          DEFAULT: "#e8eaf6",
          light: "#0d1117",
        },
        muted: {
          DEFAULT: "rgba(232,234,246,0.68)",
          light: "rgba(13,17,23,0.62)",
        },
        glow: {
          DEFAULT: "rgba(79,142,255,0.18)",
          light: "rgba(79,142,255,0.12)",
        },

        // Category card gradients (from-to pairs)
        cat: {
          "1-from": "#1a3a6e",
          "1-to": "#2d5be3",
          "2-from": "#3b1a6e",
          "2-to": "#8b2fe6",
          "3-from": "#6e1a1a",
          "3-to": "#e63b2f",
          "4-from": "#1a5c4a",
          "4-to": "#2db38c",
          "5-from": "#5c4a1a",
          "5-to": "#d4a024",
          "6-from": "#1a4a5c",
          "6-to": "#2480b3",
          "7-from": "#5c1a4a",
          "7-to": "#b32480",
          "8-from": "#1a5c1a",
          "8-to": "#24b349",
        },
      },

      /* ── Spacing & Sizing ──────────────────────────────────────── */
      spacing: {
        "nav-h": "68px",
        "section-px": "48px",
        "section-py": "120px",
      },
      maxWidth: {
        content: "1200px",
        tutors: "1000px",
        testimonials: "900px",
        cta: "720px",
        "hero-sub": "520px",
      },

      /* ── Border Radius ─────────────────────────────────────────── */
      borderRadius: {
        card: "20px",
        "card-lg": "24px",
        "card-xl": "32px",
        icon: "14px",
        pill: "100px",
      },

      /* ── Font Sizes ────────────────────────────────────────────── */
      fontSize: {
        "hero-title": [
          "clamp(3.5rem, 8vw, 7.5rem)",
          { lineHeight: "1.0", letterSpacing: "-0.03em" },
        ],
        "section-title": [
          "clamp(2rem, 4vw, 3rem)",
          { lineHeight: "1.2", letterSpacing: "-0.01em" },
        ],
        "section-label": [
          "0.72rem",
          { letterSpacing: "0.16em", fontWeight: "700" },
        ],
        "stat-num": ["2rem", { fontWeight: "800" }],
      },

      /* ── Box Shadows (glow effects) ────────────────────────────── */
      boxShadow: {
        "glow-sm": "0 0 20px rgba(79,142,255,0.3)",
        glow: "0 0 32px rgba(79,142,255,0.4)",
        "glow-lg": "0 0 52px rgba(79,142,255,0.6)",
      },

      /* ── Backdrop Blur ─────────────────────────────────────────── */
      backdropBlur: {
        nav: "24px",
      },

      /* ── Keyframe Animations ───────────────────────────────────── */
      keyframes: {
        fadeUp: {
          from: { opacity: "0", transform: "translateY(30px)" },
          to: { opacity: "1", transform: "none" },
        },
        shimmer: {
          "0%": { backgroundPosition: "0%" },
          "100%": { backgroundPosition: "200%" },
        },
        pulse: {
          "0%, 100%": { opacity: "1", transform: "scale(1)" },
          "50%": { opacity: "0.4", transform: "scale(0.7)" },
        },
        drift: {
          from: { transform: "translate(0,0)" },
          to: { transform: "translate(40px,30px)" },
        },
        scan: {
          "0%": { top: "0" },
          "100%": { top: "100vh" },
        },
      },
      animation: {
        "fade-up": "fadeUp 0.8s ease both",
        "fade-up-1": "fadeUp 0.8s 0.1s ease both",
        "fade-up-2": "fadeUp 0.8s 0.2s ease both",
        "fade-up-3": "fadeUp 0.8s 0.3s ease both",
        "fade-up-4": "fadeUp 0.8s 0.45s ease both",
        shimmer: "shimmer 4s infinite linear",
        pulse: "pulse 2s infinite",
        drift: "drift 20s infinite alternate ease-in-out",
        scan: "scan 8s linear infinite",
      },
    },
  },
  plugins: [],
};

export default config;
