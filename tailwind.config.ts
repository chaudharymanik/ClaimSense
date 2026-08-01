import type { Config } from "tailwindcss";
import forms from "@tailwindcss/forms";
import containerQueries from "@tailwindcss/container-queries";

// Design tokens ported verbatim from Design/plum_claimsense/DESIGN.md and the
// Design/*/code.html mockups (claims_dashboard, new_claim_submission_form,
// claim_detail_view, manual_review_queue all embed this identical config).
// Do not hand-tune these values — if a token needs to change, change it in
// the Design/ source first, then re-port here.
const config: Config = {
  darkMode: "class",
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        "on-secondary-fixed-variant": "#484360",
        "error-container": "#ffdad6",
        "surface-container-low": "#f6f3f2",
        "on-tertiary-fixed-variant": "#494741",
        "inverse-on-surface": "#f3f0f0",
        "surface-dim": "#dcd9d9",
        "on-tertiary-fixed": "#1d1c17",
        primary: "#b81029",
        tertiary: "#5e5c56",
        "on-tertiary-container": "#fffbff",
        error: "#ba1a1a",
        "on-error-container": "#93000a",
        "tertiary-container": "#77746e",
        "on-secondary": "#ffffff",
        "secondary-container": "#e1d8fd",
        "outline-variant": "#e4bdbc",
        "on-background": "#1b1c1c",
        "surface-container-lowest": "#ffffff",
        "surface-tint": "#bb142b",
        "on-primary-fixed-variant": "#92001c",
        "primary-fixed-dim": "#ffb3b1",
        "surface-container-high": "#eae8e7",
        "primary-fixed": "#ffdad8",
        background: "#fbf9f8",
        "on-primary-container": "#fffbff",
        "on-secondary-fixed": "#1d1833",
        "on-primary": "#ffffff",
        "secondary-fixed": "#e6deff",
        "on-tertiary": "#ffffff",
        "on-secondary-container": "#635d7c",
        "on-surface-variant": "#5b403f",
        "secondary-fixed-dim": "#cac2e6",
        "tertiary-fixed-dim": "#cac6be",
        "surface-bright": "#fbf9f8",
        surface: "#fbf9f8",
        "tertiary-fixed": "#e7e2da",
        "on-error": "#ffffff",
        secondary: "#605a79",
        "on-primary-fixed": "#410007",
        "on-surface": "#1b1c1c",
        outline: "#8f6f6e",
        "inverse-primary": "#ffb3b1",
        "surface-container-highest": "#e4e2e1",
        "surface-variant": "#e4e2e1",
        "inverse-surface": "#303030",
        "primary-container": "#db303f",
        "surface-container": "#f0eded",
        // Login page only (Design/login_page/code.html) — an atmospheric
        // dark variant, not part of the main app's light surface palette.
        "brand-navy": "#1A1530",
        "brand-coral": "#FF4B55",
        "brand-cream": "#F5F0E8",
      },
      borderRadius: {
        DEFAULT: "0.25rem",
        lg: "0.5rem",
        xl: "0.75rem",
        full: "9999px",
      },
      spacing: {
        "stack-md": "16px",
        unit: "8px",
        "gutter-grid": "24px",
        "padding-card": "24px",
        "margin-page": "40px",
        "stack-sm": "8px",
        "stack-lg": "32px",
      },
      fontFamily: {
        // Bound to next/font/google CSS variables set in app/layout.tsx, not literal
        // font names, so the fonts are subset/self-hosted by Next instead of a raw
        // Google Fonts <link> (which is what the Design/ mockups use directly).
        "body-md": ["var(--font-inter)", "sans-serif"],
        "display-lg": ["var(--font-libre-caslon)", "serif"],
        "data-mono": ["var(--font-jetbrains-mono)", "monospace"],
        "body-lg": ["var(--font-inter)", "sans-serif"],
        "headline-sm": ["var(--font-libre-caslon)", "serif"],
        "body-sm": ["var(--font-inter)", "sans-serif"],
        "label-caps": ["var(--font-inter)", "sans-serif"],
        "display-md": ["var(--font-libre-caslon)", "serif"],
      },
      fontSize: {
        "body-md": ["16px", { lineHeight: "1.6", fontWeight: "400" }],
        "display-lg": [
          "48px",
          { lineHeight: "1.2", letterSpacing: "-0.02em", fontWeight: "400" },
        ],
        "data-mono": ["13px", { lineHeight: "1.4", fontWeight: "400" }],
        "body-lg": ["18px", { lineHeight: "1.6", fontWeight: "400" }],
        "headline-sm": ["24px", { lineHeight: "1.4", fontWeight: "400" }],
        "body-sm": ["14px", { lineHeight: "1.5", fontWeight: "400" }],
        "label-caps": [
          "12px",
          { lineHeight: "1.2", letterSpacing: "0.1em", fontWeight: "600" },
        ],
        "display-md": ["32px", { lineHeight: "1.3", fontWeight: "400" }],
      },
    },
  },
  plugins: [forms, containerQueries],
};

export default config;
