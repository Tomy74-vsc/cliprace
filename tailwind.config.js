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
        border: "var(--border)",
        input: "var(--input)",
        ring: "var(--ring)",
        background: "var(--background)",
        foreground: "var(--foreground)",
        card: "var(--card)",
        "card-foreground": "var(--card-foreground)",
        popover: "var(--popover)",
        "popover-foreground": "var(--popover-foreground)",
        primary: "var(--primary)",
        "primary-foreground": "var(--primary-foreground)",
        secondary: "var(--secondary)",
        "secondary-foreground": "var(--secondary-foreground)",
        muted: "var(--muted)",
        "muted-foreground": "var(--muted-foreground)",
        accent: "var(--accent)",
        "accent-foreground": "var(--accent-foreground)",
        destructive: "var(--destructive)",
        "destructive-foreground": "var(--destructive-foreground)",
        success: "#10b981", // emerald-500
        warning: "#f59e0b", // amber-500
        danger: "#f43f5e", // rose-500
      },
      fontFamily: {
        sans: ["var(--font-sans)", "var(--font-inter)", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
      boxShadow: {
        card: "0 12px 35px -18px rgba(2, 6, 23, 0.25)",
        "card-hover": "0 18px 50px -22px rgba(99, 102, 241, 0.35)",
        "inset-soft": "inset 0 1px 0 rgba(255,255,255,0.03)",
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 4px)",
        sm: "calc(var(--radius) - 6px)",
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
