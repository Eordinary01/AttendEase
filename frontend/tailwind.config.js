/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx}"],
  darkMode: "class",
  theme: {
    extend: {
      fontFamily: {
        sans: ["'IBM Plex Sans'", "system-ui", "-apple-system", "sans-serif"],
        mono: ["'IBM Plex Mono'", "monospace"],
      },
      borderRadius: {
        sm: "0.125rem",
        DEFAULT: "0.25rem",
        md: "0.25rem",
        lg: "0.375rem",
        panel: "0.375rem",
        xl: "0.5rem",
      },
      colors: {
        primary: {
          DEFAULT: "rgb(var(--color-primary) / <alpha-value>)",
          hover: "rgb(var(--color-primary-hover) / <alpha-value>)",
          active: "rgb(var(--color-primary-active) / <alpha-value>)",
          light: "rgb(var(--color-primary-light) / <alpha-value>)",
          dark: "rgb(var(--color-primary-dark) / <alpha-value>)",
          soft: "rgb(var(--color-primary-soft) / <alpha-value>)",
          surface: "rgb(var(--color-primary-surface) / <alpha-value>)",
          container: "rgb(var(--color-primary-container) / <alpha-value>)",
          ink: "rgb(var(--color-primary-ink) / <alpha-value>)",
        },
        "on-primary": "rgb(var(--color-on-primary) / <alpha-value>)",
        secondary: {
          DEFAULT: "rgb(var(--color-secondary) / <alpha-value>)",
          light: "rgb(var(--color-secondary-light) / <alpha-value>)",
          dark: "rgb(var(--color-secondary-dark) / <alpha-value>)",
          soft: "rgb(var(--color-secondary-soft) / <alpha-value>)",
          surface: "rgb(var(--color-secondary-surface) / <alpha-value>)",
          container: "rgb(var(--color-secondary-container) / <alpha-value>)",
        },
        "on-secondary": "rgb(var(--color-on-secondary) / <alpha-value>)",
        accent: "rgb(var(--color-accent) / <alpha-value>)",
        surface: {
          DEFAULT: "rgb(var(--color-surface) / <alpha-value>)",
          subtle: "rgb(var(--color-surface-subtle) / <alpha-value>)",
          alt: "rgb(var(--color-surface-alt) / <alpha-value>)",
          container: "rgb(var(--color-surface-container) / <alpha-value>)",
          "container-high": "rgb(var(--color-surface-container-high) / <alpha-value>)",
          "container-highest": "rgb(var(--color-surface-container-highest) / <alpha-value>)",
        },
        background: "rgb(var(--color-background) / <alpha-value>)",
        ink: {
          DEFAULT: "rgb(var(--color-ink) / <alpha-value>)",
          muted: "rgb(var(--color-ink-muted) / <alpha-value>)",
          soft: "rgb(var(--color-ink-soft) / <alpha-value>)",
          faint: "rgb(var(--color-ink-faint) / <alpha-value>)",
          disabled: "rgb(var(--color-ink-disabled) / <alpha-value>)",
        },
        line: {
          DEFAULT: "rgb(var(--color-line) / <alpha-value>)",
          strong: "rgb(var(--color-line-strong) / <alpha-value>)",
        },
        status: {
          success: {
            bg: "rgb(var(--color-status-success-bg) / <alpha-value>)",
            border: "rgb(var(--color-status-success-border) / <alpha-value>)",
            text: "rgb(var(--color-status-success-text) / <alpha-value>)",
          },
          error: {
            bg: "rgb(var(--color-status-error-bg) / <alpha-value>)",
            border: "rgb(var(--color-status-error-border) / <alpha-value>)",
            text: "rgb(var(--color-status-error-text) / <alpha-value>)",
          },
          warning: {
            bg: "rgb(var(--color-status-warning-bg) / <alpha-value>)",
            border: "rgb(var(--color-status-warning-border) / <alpha-value>)",
            text: "rgb(var(--color-status-warning-text) / <alpha-value>)",
          },
          info: {
            bg: "rgb(var(--color-status-info-bg) / <alpha-value>)",
            border: "rgb(var(--color-status-info-border) / <alpha-value>)",
            text: "rgb(var(--color-status-info-text) / <alpha-value>)",
          },
        },
        chart: {
          1: "rgb(var(--color-chart-1) / <alpha-value>)",
          2: "rgb(var(--color-chart-2) / <alpha-value>)",
          3: "rgb(var(--color-chart-3) / <alpha-value>)",
          4: "rgb(var(--color-chart-4) / <alpha-value>)",
        },
      },
      boxShadow: {
        level0: "none",
        level1: "none",
        level2: "0 1px 2px 0 rgba(17, 24, 39, 0.05)",
        level3: "0 4px 6px -1px rgba(17, 24, 39, 0.08), 0 2px 4px -2px rgba(17, 24, 39, 0.04)",
        level4: "0 10px 15px -3px rgba(17, 24, 39, 0.12), 0 4px 6px -4px rgba(17, 24, 39, 0.06)",
        card: "0 1px 2px 0 rgba(17, 24, 39, 0.05)",
        cardhover: "0 4px 6px -1px rgba(17, 24, 39, 0.08)",
        pop: "0 10px 15px -3px rgba(17, 24, 39, 0.12)",
      },
    },
  },
  plugins: [],
};

