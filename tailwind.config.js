/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "var(--font-inter)", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
    },
  },
  safelist: [
    // Status colors possibly generated dynamically
    "text-red-600",
    "text-green-600",
    "text-blue-600",
    "text-yellow-600",
    "dark:text-red-400",
    "dark:text-green-400",
    "dark:text-blue-400",
    "dark:text-yellow-400",
    // Borders and rings used conditionally
    "border-red-500",
    "border-green-500",
    "focus-visible:ring-red-500",
    "focus-visible:ring-green-500",
    // Width percentages used in progress bar
    "w-0",
    "w-1/2",
    "w-full",
    // Grid columns conditional
    "grid-cols-1",
    "sm:grid-cols-2",
    // Opacity utility used for disabled states
    "opacity-50",
    // Gradient backgrounds for CTAs
    "bg-gradient-to-r",
    "from-green-600",
    "to-emerald-600",
    "hover:from-green-700",
    "hover:to-emerald-700",
    // Role cards gradient and states
    "from-indigo-50",
    "to-violet-50",
    "dark:from-indigo-950/20",
    "dark:to-violet-950/20",
    "group-hover:text-indigo-900",
    "dark:group-hover:text-indigo-100",
  ],
  plugins: [],
};
