/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                field: '#1a472a',
                'field-dark': '#0d2b18',
                endzone: '#c5b358',
                'yard-line': 'rgba(255, 255, 255, 0.4)',
            },
            fontFamily: {
                sans: ['Inter', 'system-ui', 'sans-serif'],
                display: ['Oswald', 'Impact', 'sans-serif'],
            }
        },
    },
    plugins: [],
}
