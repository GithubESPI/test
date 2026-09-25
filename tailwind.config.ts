import type { Config } from "tailwindcss";
import animate from "tailwindcss-animate";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      fontFamily: {
        sans: ["var(--font-commissioner)", "system-ui", "sans-serif"],
        serif: ["var(--font-pt-serif)", "Georgia", "serif"],
      },
      colors: {
        // 🎨 Palette officielle ESPI (charte graphique) — teintes = couleur mélangée à du blanc
        espi: {
          DEFAULT: "#004976", // Bleu Élévation (Pantone 7693 C / RAL 5010)
          90: "#195B84", // filigrane sur aplat (90 %-80 %)
          80: "#336D91",
          65: "#5989A6", // annotations (65 %-50 %)
          50: "#80A4BB",
          25: "#BFD2DD", // encadrés (25 %-5 %)
          10: "#E6EDF1",
          5: "#F2F6F8", // filigrane sur page (10 %-5 %)
          // Palette secondaire — à associer au Bleu Élévation ou au noir, avec un contraste suffisant
          rose: { DEFAULT: "#FF7D97", 80: "#FF97AC", 50: "#FFBECB", 25: "#FFDFE5" }, // Rose Visionnaire
          ocre: { DEFAULT: "#FFB461", 80: "#FFC381", 50: "#FFDAB0", 25: "#FFECD8" }, // Ocre Académique
          excellence: { DEFAULT: "#47B5E0", 80: "#6CC4E6", 50: "#A3DAF0", 25: "#D1EDF7" }, // Bleu Excellence
        },
        background: "var(--background)",
        foreground: "var(--foreground)",
        card: {
          DEFAULT: "var(--card)",
          foreground: "var(--card-foreground)",
        },
        popover: {
          DEFAULT: "var(--popover)",
          foreground: "var(--popover-foreground)",
        },
        primary: {
          "50": "#004976",
          DEFAULT: "var(--primary)",
          foreground: "var(--primary-foreground)",
        },
        secondary: {
          DEFAULT: "var(--secondary)",
          foreground: "var(--secondary-foreground)",
        },
        third: {
          "50": "#004976",
          DEFAULT: "var(--primary)",
          foreground: "var(--primary-foreground)",
        },
        destructive: {
          "50": "#ed6d68",
          DEFAULT: "var(--destructive)",
          foreground: "var(--destructive-foreground)",
        },
        muted: {
          DEFAULT: "var(--muted)",
          foreground: "var(--muted-foreground)",
        },
        accent: {
          DEFAULT: "var(--accent)",
          foreground: "var(--accent-foreground)",
        },
        border: "var(--border)",
        input: "var(--input)",
        ring: "var(--ring)",
        chart: {
          "1": "var(--chart-1)",
          "2": "var(--chart-2)",
          "3": "var(--chart-3)",
          "4": "var(--chart-4)",
          "5": "var(--chart-5)",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "fade-in": {
          from: {
            opacity: "0",
          },
          to: {
            opacity: "1",
          },
        },
        marquee: {
          "100%": {
            transform: "translateY(-50%)",
          },
        },
        flashing: {
          "0%, 100%": {
            opacity: "0.2",
          },
          "20%": {
            opacity: "1",
          },
        },
        "accordion-down": {
          from: {
            height: "0",
          },
          to: {
            height: "var(--radix-accordion-content-height)",
          },
        },
        "accordion-up": {
          from: {
            height: "var(--radix-accordion-content-height)",
          },
          to: {
            height: "0",
          },
        },
        "shiny-text": {
          "0%, 90%, 100%": {
            "background-position": "calc(-100% - var(--shiny-width)) 0",
          },
          "30%, 60%": {
            "background-position": "calc(100% + var(--shiny-width)) 0",
          },
        },
      },
      animation: {
        marquee: "marquee var(--marquee-duration) linear infinite",
        "fade-in": "fade-in 0.5s linear forwards",
        flashing: "flashing 1.4s infinite linear",
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "shiny-text": "shiny-text 8s infinite",
      },
    },
  },
  plugins: [animate],
} satisfies Config;

export default config;
