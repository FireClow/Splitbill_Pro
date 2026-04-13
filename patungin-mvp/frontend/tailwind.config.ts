import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{js,ts,jsx,tsx}", "./components/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          ink: "#16324f",
          tide: "#2f7e79",
          mango: "#fda85d",
          foam: "#f2f8f7",
        },
      },
      boxShadow: {
        floating: "0 18px 40px -20px rgba(22, 50, 79, 0.35)",
      },
      keyframes: {
        rise: {
          "0%": { opacity: "0", transform: "translateY(20px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        rise: "rise 0.45s ease-out forwards",
      },
    },
  },
  plugins: [],
};

export default config;
