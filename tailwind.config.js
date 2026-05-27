/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#081521",
        mist: "#eef4f7",
        copper: "#b85f2c",
        pine: "#123a35",
        slate: "#365166",
        sand: "#f4e7cf"
      },
      boxShadow: {
        panel: "0 24px 60px rgba(6, 22, 33, 0.12)"
      }
    }
  },
  plugins: []
};
