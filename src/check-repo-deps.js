const depcheck = require('depcheck')

const glob = require('glob')
const path = require('path')
const os = require('os')

const pathToUnixPath = os.platform() === 'win32' ? (str) => str.replace(/\\/g, '/') : (str) => str

function check(options) {
    const {
        pattern = './packages/**/package.json',
        ignoredMissingsDeps = {},
        ignoreUnusedDeps = {},
        ignoredPackages = [],
        allowedDevDeps = [],
        withoutDev = true,
        ignoreDirs = [],
        ignoreMatches = [],
        namespace,
        innerDepsType = 'strict',
        strictDepsPathPatterns = [],
        minorDepsPathPatterns = [],
    } = options

    if (!namespace) {
        throw new Error(`Namespace is not defined in config`)
    }

    const depCheckOptions = {
        withoutDev,
        ignoreDirs,
        ignoreMatches
    }

    const buildFiles = glob
        .sync(pattern)
        .filter((file) => file.indexOf('__') === -1 && file.indexOf('node_modules') === -1)

    const missingDependencies = {}
    const unusedDependencies = {}

    const promiseResults = []

    const incorrectDepsTypes = []

    buildFiles.forEach((file) => {
        const packageDir = pathToUnixPath(path.resolve(file.replace('package.json', '')))
        const packageName = packageDir.slice(packageDir.lastIndexOf('/') + 1)

        const pkg = require(path.resolve(file))

        if (pkg.private) {
            return
        }
        if (pkg.devDependencies && allowedDevDeps.indexOf(packageName) === -1) {
            incorrectDepsTypes.push(`${packageName} - devDependencies found`)
        }
        if (pkg.dependencies) {
            Object.keys(pkg.dependencies).forEach((depName) => {
                if (depName.indexOf(namespace) !== -1) {
                    const depVersion = pkg.dependencies[depName]
                    let localInnerDepsType = innerDepsType
                    if (strictDepsPathPatterns.some(pattern => packageDir.indexOf(pattern) !== -1)) {
                        localInnerDepsType = 'strict'
                    }
                    if (minorDepsPathPatterns.some(pattern => packageDir.indexOf(pattern) !== -1)) {
                        localInnerDepsType = '^'
                    }
                    if (localInnerDepsType === 'strict' && depVersion.indexOf('^') !== -1
                        || localInnerDepsType === '^' && depVersion.indexOf('^') === -1)
                    {
                        incorrectDepsTypes.push(`${packageName} - ${depName}: ${depVersion}`)
                    }
                }
            })
        }

        if (ignoredPackages.indexOf(packageName) === -1) {
            const awaitResult = new Promise((resolve, reject) => {
                depcheck(packageDir, depCheckOptions, (result) => {
                    // проверка на отсутствующие зависимости
                    const allMissing = result.missing
                    const missing = {}
                    Object.keys(allMissing).forEach((depName) => {
                        if (
                            (!ignoredMissingsDeps[packageName] || ignoredMissingsDeps[packageName].indexOf(depName) === -1) &&
                            depName !== packageName
                        ) {
                            allMissing[depName] = allMissing[depName].filter((fileName) => fileName.indexOf('.stories.') === -1)
                            if (allMissing[depName].length > 0) {
                                missing[depName] = allMissing[depName]
                            }
                        }
                    })
                    if (Object.keys(missing).length > 0) {
                        missingDependencies[packageName] = missing
                    }

                    const allUnused = result.dependencies
                    const unused = []
                    Object.keys(allUnused)
                        .map((i) => allUnused[i])
                        .forEach((depName) => {
                            if (!ignoreUnusedDeps[packageName] || ignoreUnusedDeps[packageName].indexOf(depName) === -1) {
                                unused.push(depName)
                            }
                        })
                    if (Object.keys(unused).length > 0) {
                        unusedDependencies[packageName] = unused
                    }

                    resolve()
                })
            })
            promiseResults.push(awaitResult)
        }
    })

    const result = {
        missing: missingDependencies,
        unused: unusedDependencies,
    }

    if (incorrectDepsTypes.length > 0) {
        // eslint-disable-next-line no-console
        console.error('Packages has incorrect dependencies types: ')
        // eslint-disable-next-line no-console
        incorrectDepsTypes.forEach((errorText) => console.error('   ' + errorText))
        process.exit(1)
    }

    return Promise.all(promiseResults).then(() => {
        if (Object.keys(missingDependencies).length > 0 || Object.keys(unusedDependencies).length > 0) {
            // eslint-disable-next-line no-console
            console.error('Packages has missing or unused dependencies. Fix it, please.')
            // eslint-disable-next-line no-console
            console.error(
                'tip: it is possible some file has syntax error and cannot be parsed. Try `make build-lib` to check that.'
            )
            // eslint-disable-next-line no-console
            console.error(JSON.stringify(result, undefined, 2))
            process.exit(1)
        } else {
            // eslint-disable-next-line no-console
            console.log('Dependencies ok!')
        }
    })

}

module.exports = {
    check
}
