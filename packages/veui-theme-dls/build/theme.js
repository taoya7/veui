import { resolve } from 'path'
import { existsSync, writeFileSync } from 'fs'
import components from '../../veui/components.json'

const themeDir = resolve(__dirname, '..')

// 简单实现
function kebabCase (str) {
  return str.replace(/[A-Z]/g, s => `-${s.toLowerCase()}`).replace(/^-/, '')
}

function getSortedComponents () {
  let result = []
  components.forEach(({ name }) => {
    if (result.indexOf(name) === -1) {
      result.push(name)
    }
  })
  return result
}

function genThemeIndex (sortedComponents) {
  const theme = sortedComponents.reduce(
    (acc, name) => {
      if (existsSync(`${themeDir}/components/${name}.js`)) {
        acc.js.push(`import './components/${name}'`)
      }
      if (existsSync(`${themeDir}/components/${kebabCase(name)}.less`)) {
        acc.less.push(`import './components/${kebabCase(name)}.less'`)
      }
      return acc
    },
    { js: [], less: [] }
  )

  const content =
    '// This file is generated automatically by `npm run theme`\n' +
    theme.js.join('\n') +
    '\n\n' +
    `import './common.less'\n` +
    theme.less.join('\n') +
    '\n'

  writeFileSync(`${themeDir}/index.js`, content, { encoding: 'utf-8' })
}

genThemeIndex(getSortedComponents())
