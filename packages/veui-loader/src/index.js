import fs from 'fs'
import path from 'path'
import pkgDir from 'pkg-dir'
import slash from 'slash'
import loaderUtils from 'loader-utils'
import MagicString from 'magic-string'
import { kebabCase, camelCase, pascalCase, getJSON, normalize } from './utils'

const VEUI_PACKAGE_NAME = 'veui'

const COMPONENTS_DIRNAME = 'components'
const EXT_TYPES = {
  SCRIPT: ['js'],
  STYLE: ['css', 'less', 'styl', 'sass', 'scss']
}

let resolveCache = {}

/**
 * webpack loader to load theme/locale modules for VEUI components
 * @param {string} content Raw file content of .vue file
 * @returns {Promise<string>} A promise that resolved with the content of patched .vue file
 */
export default async function (content) {
  let callback = this.async()
  const loaderOptions = loaderUtils.getOptions(this) || {}
  let component = resolveComponent(this.resourcePath, loaderOptions)
  if (!component) {
    callback(null, content)
    return
  }

  try {
    let result = await patchComponent(
      new MagicString(content),
      component,
      loaderOptions,
      (path) => {
        return new Promise((resolve) => {
          try {
            this.resolve(
              this.rootContext || this.options.context,
              path,
              (err) => {
                if (err) {
                  resolve(false)
                  return
                }
                resolve(true)
              }
            )
          } catch (e) {
            resolve(false)
          }
        })
      }
    )

    callback(
      null,
      result.toString(),
      this.sourceMap
        ? result.generateMap({
          file: path.basename(this.resourcePath)
        })
        : null
    )
  } catch (e) {
    console.error(e)
    callback(e)
  }
}

/**
 * Synchronously transform the module with a given resolveSync function.
 *
 * @param {string} content Module content
 * @param {string} file Module file path
 * @param {Object} options veui-loader options
 * @param {Function} resolveSync Resolves module path to file path
 */
export function processSync (content, file, options, resolveSync) {
  let component = resolveComponent(file, options)
  if (!component) {
    return content
  }

  return patchComponentSync(content, component, options, resolveSync)
}

/**
 * Patch the original .vue file with additional peer modules.
 * @param {MagicString} content .vue file content
 * @param {string} component Component name
 * @param {Object} options veui-loader options
 * @param {function} resolve webpack resolve function to see if target peer exists
 * @returns {Promise<MagicString>} A promise that resolved with the patched content
 */
async function patchComponent (content, component, options, resolve) {
  let parts = getParts(component, options)

  await Promise.all(
    [...parts.script, ...parts.style].map(async (module) => {
      module.valid = await assurePath(module.path, resolve)
    })
  )

  return patchContent(content, parts)
}

/**
 * Patch the original .vue file with additional peer modules.
 * @param {MagicString} content .vue file content
 * @param {string} component Component name
 * @param {Object} options veui-loader options
 * @param {function} resolveSync custom synchronous resolve function to see if target peer exists
 * @returns {MagicString} The patched content
 */
function patchComponentSync (content, component, options, resolveSync) {
  let parts = getParts(component, options)
  let modules = [...parts.script, ...parts.style]

  modules.forEach((module) => {
    module.valid = assurePathSync(module.path, resolveSync)
  })

  return patchContent(content, parts)
}

/**
 * Extract potentially dependent parts for a component
 *
 * @param {string} component Component name
 * @param {Object} options veui-loader options
 * @returns {Object} Extracted parts metadata
 */
function getParts (component, options) {
  let {
    alias = VEUI_PACKAGE_NAME,
    modules = [],
    package: pack,
    path: packPath = COMPONENTS_DIRNAME,
    transform,
    fileName,
    locale,
    global = []
  } = options

  if (pack && fileName) {
    modules.push({ package: pack, path: packPath, transform, fileName })
  }

  if (locale !== false) {
    if (!locale) {
      locale = 'zh-Hans'
    }

    if (!Array.isArray(locale)) {
      locale = [locale]
    }
    locale = locale.filter((l) => typeof l === 'string')
    modules = locale
      .map((l) => {
        return {
          package: alias,
          path: `locale/${l}`,
          transform: false,
          fileName: '{module}.js'
        }
      })
      .concat(modules)

    global = locale
      .map((l) => {
        return { path: `${alias}/locale/${l}/common.js` }
      })
      .concat(global.map((path) => ({ path })))
  }

  return modules.reduce(
    (
      acc,
      {
        package: pack,
        path: packPath = COMPONENTS_DIRNAME,
        transform,
        fileName
      }
    ) => {
      let peerComponent = getPeerFilename(component, {
        transform,
        template: fileName
      })
      let peerPath = slash(path.join(pack, packPath, peerComponent))
      pushPart(acc, { path: peerPath })
      return acc
    },
    {
      script: [...global],
      style: []
    }
  )
}

/**
 * Patch content with extracted parts metadata
 *
 * @param {MagicString} content Module content
 * @param {Object} parts Extracted parts metadata
 * @returns {MagicString} Patched content
 */
function patchContent (content, parts) {
  Object.keys(parts).forEach((type) => {
    let paths = parts[type].filter(({ valid }) => valid).map(({ path }) => path)
    return patchType(content, type, paths)
  })

  return content
}

/**
 * Push peer file dependency into collected parts.
 * @param {Object} parts Collected parts containing scripts and styles
 * @param {Object} file The file to be appended
 */
function pushPart (parts, file) {
  let ext = getExtname(file.path)
  let type = Object.keys(EXT_TYPES).find((key) => {
    return EXT_TYPES[key].includes(ext)
  })
  parts[type.toLowerCase()].push(file)
}

/**
 * Get extension name of a file
 * @param {string} file File path
 * @returns {string} File extension
 */
function getExtname (file) {
  return path.extname(file).replace(/\./g, '').toLowerCase()
}

const RE_SCRIPT = /<script(?:\s+[^>]*)?>/i

/**
 * Patch file content according to a given type.
 * @param {MagicString} content Original content
 * @param {string} type Peer type, can be `script` or `style`
 * @param {Array<string>} peerPaths Peer module paths
 * @returns {MagicString} The patched content
 */
function patchType (content, type, peerPaths) {
  const code = content.toString()
  let normalizedPaths = peerPaths.map((path) => slash(normalize(path)))
  switch (type) {
    case 'script':
      let scriptImports = normalizedPaths.map((path) => `import '${path}'\n`)
      code.replace(RE_SCRIPT, (match, offset) => {
        const replacement = `${match}\n${scriptImports.join('')}`
        content.overwrite(offset, offset + match.length, replacement)
        return replacement
      })
      break
    case 'style':
      let styleImports = normalizedPaths.map((path) => {
        let langStr = ''
        let ext = getExtname(path)
        if (ext !== 'css') {
          langStr = `lang="${ext}" `
        }
        return `<style ${langStr}src="${path}"></style>\n`
      })

      content.append(styleImports.join(''))
      break
    default:
      break
  }

  return content
}

/**
 * To test the target peer path exists or not.
 * @param {string} modulePath Peer module path
 * @param {function} resolve webpack module resolver
 * @returns {Promise<boolean>} A promise resolved with true if the target peer path exists
 */
async function assurePath (modulePath, resolve) {
  if (resolveCache[modulePath] === false) {
    return false
  } else if (!(modulePath in resolveCache)) {
    if (typeof resolve === 'function') {
      try {
        resolveCache[modulePath] = !!(await resolve(modulePath))
      } catch (e) {
        resolveCache[modulePath] = false
      }
    }
  }

  return resolveCache[modulePath]
}

/**
 * To test the target peer path exists or not synchronously.
 * @param {string} modulePath Peer module path
 * @param {function} resolveSync webpack module resolver
 * @returns {boolean} True if the target peer path exists
 */
function assurePathSync (modulePath, resolveSync) {
  if (resolveCache[modulePath] === false) {
    return false
  } else if (!(modulePath in resolveCache)) {
    if (typeof resolveSync === 'function') {
      try {
        resolveCache[modulePath] = !!resolveSync(modulePath)
      } catch (e) {
        resolveCache[modulePath] = false
      }
    }
  }

  return resolveCache[modulePath]
}

/**
 * Convert a component name according to file name template.
 * @param {string} name Peer module file
 * @param {Object} options Transform options
 * @param {string} options.transform Transform type for base name
 * @param {string} options.template File name template
 * @returns {string} Peer module file name
 */
function getPeerFilename (
  name,
  { transform = 'kebab-case', template = '{module}.css' }
) {
  if (!name) {
    return null
  }

  switch (transform) {
    case 'kebab-case':
      name = kebabCase(name)
      break
    case 'camelCase':
      name = camelCase(name)
      break
    case 'PascalCase':
      name = pascalCase(name)
      break
    case false:
    default:
      break
  }

  return template.replace(/\$?\{module\}/g, name)
}

/**
 * Resolve the underlying component for a given file path.
 * '/dev/veui/src/components/Button.vue' → 'Button'
 * @param {string} file Absolute file path
 * @param {Object} options veui-loader options
 * @returns {?string} The resolved component name (`null` if not a VEUI component)
 */
function resolveComponent (file, options) {
  let { alias = VEUI_PACKAGE_NAME } = options

  // make sure relative paths resolved to somewhere inside a correct VEUI
  let pkg = pkgDir.sync(file)
  let isVEUI =
    getJSON(path.join(pkg, 'package.json')).name === VEUI_PACKAGE_NAME
  if (
    !pkg ||
    // not VEUI package
    !isVEUI ||
    // is dep but dep name isn't correct
    (path.basename(path.dirname(pkg)) === 'node_modules' &&
      path.basename(pkg) !== alias)
  ) {
    return null
  }

  // veui/${dir} or veui/src/${dir}
  let dirPath = path.join(pkg, COMPONENTS_DIRNAME) // runtime
  if (!fs.existsSync(dirPath)) {
    dirPath = path.join(pkg, 'src', COMPONENTS_DIRNAME) // dev
    if (!fs.existsSync(dirPath)) {
      return null
    }
  }

  // is VEUI component
  return getComponentName(path.relative(dirPath, file), options)
}

/**
 * Convert a component relative path to a component name according to
 * VEUI's component list.
 * 'Icon.vue' → 'Icon'
 * @param {string} componentPath Component path
 * @param {Object} options veui-loader options
 * @returns {?string} Component name (`null` if not a VEUI component)
 */
function getComponentName (componentPath, options) {
  let { alias = VEUI_PACKAGE_NAME } = options
  let components = require(`${alias}/components.json`)

  if (!componentPath) {
    return null
  }
  let component = components.find(({ path }) => {
    path = normalize(path)
    return path === componentPath || path.split('.')[0] === componentPath
  })

  return component ? component.name : null
}
