export default {
  plugins: ['prettier-plugin-tailwindcss'],
  singleQuote: true,
  semi: false,
  // the Tailwind entry (theme) for class sorting: the site's; the editor's tokens sort the same way
  tailwindStylesheet: './src/styles/site.css',
  tailwindFunctions: ['clsx'],
}
