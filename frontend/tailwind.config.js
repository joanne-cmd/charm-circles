/** @type {import('tailwindcss').Config} */
export default {
    content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
    theme: {
        extend: {
            colors: {
                indigo: {
                    deep: "#312E81",
                },
                midnight: {
                    DEFAULT: "#020617",
                },
                gray: {
                    cool: "#E5E7EB",
                },
                cyan: {
                    accent: "#22D3EE",
                },
                green: {
                    success: "#16A34A",
                },
            },
        },
    },
    plugins: [],
};
