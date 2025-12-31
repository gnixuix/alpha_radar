export default {
  plugins: {
    // 关键修复：Tailwind v4 必须使用这个专用包，而不是 'tailwindcss'
    '@tailwindcss/postcss': {},
    autoprefixer: {},
  },
}