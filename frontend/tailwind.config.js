/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                primary: {
                    50: '#f0fdfa',
                    100: '#ccfbf1',
                    500: '#14b8a6', // Teal
                    600: '#0d9488',
                    900: '#134e4a',
                },
                background: '#0f172a', // Slate 900
                surface: '#1e293b',   // Slate 800
            },
            fontFamily: {
                sans: ['Inter', 'sans-serif'],
            },
            boxShadow: {
                'glow': '0 0 15px -3px rgba(20, 184, 166, 0.5)',
                'card': '0 10px 15px -3px rgba(0, 0, 0, 0.5), 0 4px 6px -2px rgba(0, 0, 0, 0.25)',
            },
            keyframes: {
                shimmer: {
                    '100%': { transform: 'translateX(300%)' },
                },
                'shimmer-vertical': {
                    '100%': { transform: 'translateY(300%)' },
                }
            }
        },
    },
    plugins: [],
}
