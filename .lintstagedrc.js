const micromatch = require('micromatch')
const { relative } = require('path')

const SCRIPT_PATTERNS = [
  'packages/{babel-plugin-veui,veui,veui-loader,veui-theme-dls}/**/*.{js,ts,vue}'
]

const STYLE_PATTERNS = [
  'packages/veui-theme-dls/**/*.less',
  'packages/veui/demo/**/*.vue'
]

const JSON_PATTERNS = [
  'packages/**/package-lock.json'
]

module.exports = staged => {
  const relativePaths = staged.map(p => relative(__dirname, p))
  const scripts = micromatch(relativePaths, SCRIPT_PATTERNS).join(' ')
  const styles = micromatch(relativePaths, STYLE_PATTERNS).join(' ')
  const jsons = micromatch(relativePaths, JSON_PATTERNS).join(' ')

  const tasks = []

  if (scripts || styles || jsons) {
    tasks.push(`prettier --write ${[scripts, styles, jsons].join(' ')}`)
  }

  if (scripts) {
    tasks.push(`eslint --fix ${scripts}`)
  }

  if (styles) {
    tasks.push(`stylelint --fix ${styles}`)
  }

  return tasks
}
