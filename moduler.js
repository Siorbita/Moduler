import express from "express"
import fs from "node:fs"
import { dirname } from "node:path"
import path from "node:path"
const __dirname = process.cwd()
let globalModules = []
const cleanExports = (fileData, moduleName, modulePath) => {
  const parts = modulePath.split("/")
  if (parts[parts.length - 1].endsWith(".js")) {
    parts.pop()
  }
  const regex2 = /export(.*)\s+from\s+\"(.*)\"/gm
  let m
  while ((m = regex2.exec(fileData)) !== null) {
    if (m[2].startsWith(".")) {
      const fullPath = path.dirname(modulePath)
      const realPath = path.normalize(`${fullPath}/${m[2]}`)
      const rootPath = realPath.split("node_modules").pop().replaceAll(/\\/g, "/").replace(/^\//g, "")
      fileData = fileData.replace(m[0], `export ${m[1]} from "/modules/${rootPath}"`)
    } else {
      fileData = fileData.replace(m[0], `export ${m[1]} from "/modules/${m[2]}"`)
    }
  }
  return fileData
}
const cleanImports = (fileData, moduleName, modulePath) => {
  const directImportRegex = /import[ \n\t]*['"]([^'"\n]+)['"]/gm
  let m
  while ((m = directImportRegex.exec(fileData)) !== null) {
    // This is necessary to avoid infinite loops with zero-width matches
    if (m.index === directImportRegex.lastIndex) {
      directImportRegex.lastIndex++
    }
    fileData = fileData.replace(m[0], `import "/modules/${m[1]}"`)
  }

  const regex = /import\s+(.*)\s+from\s+"(.*)"/gm

  while ((m = regex.exec(fileData)) !== null) {
    if (m.index === regex.lastIndex) {
      regex.lastIndex++
    }
    if (m[2].startsWith(".")) {
      const fullPath = path.dirname(modulePath)
      const realPath = path.normalize(`${fullPath}/${m[2]}`)
      const rootPath = realPath.split("node_modules").pop().replaceAll(/\\/g, "/").replace(/^\//g, "")
      fileData = fileData.replace(m[0], `import ${m[1]} from "/modules/${rootPath}"`)
    } else {
      fileData = fileData.replace(m[0], `import ${m[1]} from "/modules/${m[2]}"`)
    }
  }
  return cleanExports(fileData, moduleName, modulePath)
}
const isDirectory = (path) => {
  const stats = fs.statSync(path)
  return stats.isDirectory()
}
const findAndReturnCorrectPath = (moduleName, modulePath, cleanUrl) => {
  modulePath = modulePath.replace(/^\./, "")
  const finalPath = path.normalize(`${__dirname}/node_modules/${moduleName}${cleanUrl}`)
  const finalPathWithExtension = `${finalPath}.js`
  const finalModulePath = path.normalize(`${__dirname}/node_modules/${moduleName}${modulePath}${cleanUrl}`)
  const finalModulePathWithExtension = `${finalModulePath}.js`
  const finalIndex = path.normalize(`${finalPath}/index.js`)
  if (fs.existsSync(finalPath) && !isDirectory(finalPath)) {
    return finalPath
  } else if (fs.existsSync(finalPathWithExtension) && !isDirectory(finalPathWithExtension)) {
    return finalPathWithExtension
  } else if (fs.existsSync(finalModulePath) && !isDirectory(finalModulePath)) {
    return finalModulePath
  } else if (fs.existsSync(finalModulePathWithExtension) && !isDirectory(finalModulePathWithExtension)) {
    return finalModulePathWithExtension
  } else if (fs.existsSync(finalIndex) && !isDirectory(finalIndex)) {
    return finalIndex
  }
  console.log("Error findAndReturnCorrectPath", {
    moduleName,
    modulePath,
    cleanUrl,
    finalPath,
    finalPathWithExtension,
    finalModulePath,
    finalModulePathWithExtension,
    finalIndex
  })
  return null
}
const fileResponse = (moduleName, modulePath) => {
  return (req, res) => {
    const finalPart = req.url.replace(/^\//, "").replace(/\.\.\//g, "").replace(/^\./, "")
    const finalModulePath = `${modulePath}${finalPart}`
    const pathExists = findAndReturnCorrectPath(moduleName, modulePath, finalPart)
    if (!pathExists) {
      console.log("Error fileReponse", { moduleName, modulePath, finalPart })
      return res.send(`Path for file ${finalModulePath} not found in module ${moduleName}`)
    }
    const fileData = fs.readFileSync(`${pathExists}`, "utf-8")
    res.header("Content-Type", "application/javascript")
    res.send(cleanImports(fileData, moduleName, pathExists))
  }
}
const directoryResponse = (moduleName, modulePath) => {
  return (req, res, next) => {
    let cleanUrl = req.url.replace(/\.\.\//g, "").replace(/^\//, "").replace(/^\./, "")
    if (!cleanUrl.startsWith("/")) cleanUrl = `/${cleanUrl}`
    const finalPart = `${cleanUrl}`
    const pathExists = findAndReturnCorrectPath(moduleName, modulePath, cleanUrl)
    if (!pathExists) {
      console.log(moduleName, modulePath, cleanUrl)
      return res.send(`Path for directory ${finalPart} not found in module ${moduleName}`)
    }
    const stats = fs.statSync(`${pathExists}`)
    let fileData = null
    if (stats.isDirectory()) {
      const indexExists = fs.existsSync(`${pathExists}/index.js`)
      if (indexExists) {
        fileData = fs.readFileSync(`${pathExists}/index.js`, "utf-8")
      }
    } else {
      fileData = fs.readFileSync(`${pathExists}`, "utf-8")
    }
    res.header("Content-Type", "application/javascript")
    fileData = cleanImports(fileData, moduleName, pathExists)
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