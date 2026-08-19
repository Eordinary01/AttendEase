/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "rgb(var(--color-primary) / <alpha-value>)",
          light: "rgb(var(--color-primary-light) / <alpha-value>)",
          dark: "rgb(var(--color-primary-dark) / <alpha-value>)",
          soft: "rgb(var(--color-primary-soft) / <alpha-value>)",
          surface: "rgb(var(--color-primary-surface) / <alpha-value>)",
        },
        secondary: {
          DEFAULT: "rgb(var(--color-secondary) / <alpha-value>)",
          light: "rgb(var(--color-secondary-light) / <alpha-value>)",
          dark: "rgb(var(--color-secondary-dark) / <alpha-value>)",
          soft: "rgb(var(--color-secondary-soft) / <alpha-value>)",
          surface: "rgb(var(--color-secondary-surface) / <alpha-value>)",
        },
        accent: "rgb(var(--color-accent) / <alpha-value>)",
        surface: "rgb(var(--color-surface) / <alpha-value>)",
        background: "rgb(var(--color-background) / <alpha-value>)",
        ink: {
          DEFAULT: "rgb(var(--color-ink) / <alpha-value>)",
          soft: "rgb(var(--color-ink-soft) / <alpha-value>)",
          faint: "rgb(var(--color-ink-faint) / <alpha-value>)",
        },
        line: "rgb(var(--color-line) / <alpha-value>)",
      },
      boxShadow: {
        card: "0 1px 2px 0 rgb(15 23 42 / 0.05), 0 1px 3px 0 rgb(15 23 42 / 0.06)",
        cardhover: "0 12px 24px -6px rgb(15 23 42 / 0.1), 0 4px 8px -4px rgb(15 23 42 / 0.04)",
        pop: "0 24px 50px -12px rgb(15 23 42 / 0.25)",
      },
    },
  },
  plugins: [],
};
