import express from "express"
import fs from "node:fs"
import { dirname } from "node:path"
const __dirname = process.cwd()
let globalModules = []
const cleanImports = (fileData, moduleName) => {
  const directImportRegex = /import[ \n\t]*['"]([^'"\n]+)['"]/gm
  let m
  while ((m = directImportRegex.exec(fileData)) !== null) {
    // This is necessary to avoid infinite loops with zero-width matches
    if (m.index === directImportRegex.lastIndex) {
      directImportRegex.lastIndex++
    }
    fileData = fileData.replace(m[0], `import "/modules/${m[1]}"`)
  }

  const regex = /import(?:(?:(?:[ \n\t]+([^ *\n\t\{\},]+)[ \n\t]*(?:,|[ \n\t]+))?([ \n\t]*\{(?:[ \n\t]*[^ \n\t"'\{\}]+[ \n\t]*,?)+\})?[ \n\t]*)|[ \n\t]*\*[ \n\t]*as[ \n\t]+([^ \n\t\{\}]+)[ \n\t]+)from[ \n\t]*(?:['"])([^'"\n]+)(['"])/gm

  while ((m = regex.exec(fileData)) !== null) {
    // This is necessary to avoid infinite loops with zero-width matches
    if (m.index === regex.lastIndex) {
      regex.lastIndex++
    }
    // The result can be accessed through the `m`-variable.
    if (m[4].startsWith(".")) continue
    if (!m[1] && !m[2]) {
      fileData = fileData.replace(m[0], `import "/modules/${m[4]}"`)
    } else {
      fileData = fileData.replace(m[0], `import ${m[2] || m[1]} from "/modules/${m[4]}"`)
    }
  }
  return fileData
}
const fileResponse = (moduleName, modulePath) => {
  return (req, res) => {
    const finalPart = req.url.replace(/^\//, "").replace(/\.\.\//g, "").replace(/^\./, "")
    const finalModulePath = `${modulePath}${finalPart}`
    const finalPath = `${__dirname}/node_modules/${moduleName}/${finalModulePath}`
    const exists = fs.existsSync(`${finalPath}`)
    if (!exists) {
      return res.send(`Path ${finalModulePath} not found in module ${moduleName}`)
    }
    const fileData = fs.readFileSync(`${finalPath}`, "utf-8")
    res.header("Content-Type", "application/javascript")
    res.send(cleanImports(fileData, moduleName))
  }
}
const directoryResponse = (moduleName, modulePath) => {
  return (req, res, next) => {
    let cleanUrl = req.url.replace(/\.\.\//g, "").replace(/^\//, "").replace(/^\./, "")
    if (!cleanUrl.startsWith("/")) cleanUrl = `/${cleanUrl}`
    const finalPart = `${modulePath}${cleanUrl}`
    const finalPath = `${__dirname}/node_modules/${moduleName}${finalPart}`
    const pathExists = fs.existsSync(`${finalPath}`)
    if (!pathExists) {
      return res.send(`Path ${finalPart} not found in module ${moduleName}`)
    }
    const stats = fs.statSync(`${finalPath}`)
    let fileData = null
    if (stats.isDirectory()) {
      const indexExists = fs.existsSync(`${finalPath}/index.js`)
      if (indexExists) {
        fileData = fs.readFileSync(`${finalPath}/index.js`, "utf-8")
      }
    } else {
      fileData = fs.readFileSync(`${finalPath}`, "utf-8")
    }
    res.header("Content-Type", "application/javascript")
    fileData = cleanImports(fileData, moduleName)
    res.send(fileData)
  }
}
const getPackageJson = (module) => {
  const exists = fs.existsSync(`./node_modules/${module}/package.json`)
  if (!exists) throw new Error(`Module ${module} not found`)
  return JSON.parse(fs.readFileSync(`./node_modules/${module}/package.json`, "utf-8"))
}
const returnLastRealImport = (localPath) => {
  if (typeof localPath == "object") {
    const result = localPath.browser || localPath.default || localPath.import || "index.js"
    if (typeof result === "object") {
      return returnLastRealImport(result)
    }
    return result
  }
  return localPath
}
export default (modules = [], app) => {
  globalModules = [...modules]
  const router = express.Router()
  for (let mod of globalModules) {
    const packageJson = getPackageJson(mod)
    const dependencies = packageJson.dependencies || {}
    for (let dep in dependencies) {
      if (!globalModules.includes(dep)) {
        globalModules.push(dep)
      }
    }
    const exports = {}
    if (packageJson.exports) {
      Object.keys(packageJson.exports).forEach(key => {
        const serverPath = key.replace(/^\./, `/`).replace(/\/\//, "/").replace(/\/\*$/, "/")
        let localPath = returnLastRealImport(packageJson.exports[key])
        if (localPath) {
          exports[serverPath] = localPath.replace(/^\./, "").replace(/\/\*$/, "/")
        }
      })
    }
    const main = packageJson.module || packageJson.main || "index.js"
    if (!exports["/"]) {
      exports["/"] = main
    }
    const moduleRouter = express.Router()
    const directories = Object.keys(exports).filter((key) => key.endsWith("/") && key != "/")
    const files = Object.keys(exports).filter((key) => !directories.includes(key))
    const alreadyAdded = []
    for (let serverPath of directories) {
      alreadyAdded.push(serverPath)
      const serverDirPath = serverPath.replace(/\/$/, "")
      moduleRouter.use(serverDirPath, directoryResponse(mod, exports[serverPath]))
    }
    for (let serverPath of files) {
      moduleRouter.get(serverPath, fileResponse(mod, exports[serverPath]))
      const serverDirPath = serverPath.split("/").slice(0, -1).join("/")
      if (alreadyAdded.includes(serverDirPath)) continue
      const localPath = dirname(exports[serverPath]).replace(/^\./, "")
      moduleRouter.use(serverDirPath, directoryResponse(mod, localPath))

    }
    router.use(`/${mod}`, moduleRouter)
  }
  if (app) {
    return app.use(`/modules`, router)
  }
  return router
}