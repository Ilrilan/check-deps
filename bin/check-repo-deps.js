#!/usr/bin/env node
/**
 * Скрипт проверяет корректность зависимостей пакета - что есть все используемые зависимости и при этом нет неиспользуемых
 * */

const os = require('os')
const pathToUnixPath = os.platform() === 'win32' ? (str) => str.replace(/\\/g, '/') : (str) => str

const { check } = require('../src/check-repo-deps')

const curPath = pathToUnixPath(process.cwd())
const configPath = curPath + '/check-repo-deps.config.js'

let options
try {
    options = require(configPath)
} catch (e) {
    console.error(`Cannot find config file in ${configPath}`)
}
return check(options)



