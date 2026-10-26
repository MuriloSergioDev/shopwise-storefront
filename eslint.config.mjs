import withNuxt from './.nuxt/eslint.config.mjs'

export default withNuxt({
  // Prettier owns formatting (it writes `<img />`).
  rules: { 'vue/html-self-closing': 'off' },
})
