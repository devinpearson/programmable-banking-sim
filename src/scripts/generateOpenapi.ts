/**
 * Writes the OpenAPI document to openapi/openapi.json and openapi.yaml.
 * Run from the project root: npm run openapi:generate
 */
import fs from 'node:fs'
import path from 'node:path'
import YAML from 'yaml'
import { openApiDocument } from '../config/openapi.js'

const OUT_DIR = path.join(process.cwd(), 'openapi')
fs.mkdirSync(OUT_DIR, { recursive: true })
fs.writeFileSync(path.join(OUT_DIR, 'openapi.json'), `${JSON.stringify(openApiDocument, null, 2)}\n`)
fs.writeFileSync(path.join(OUT_DIR, 'openapi.yaml'), YAML.stringify(openApiDocument))
console.log('OpenAPI document written to openapi/openapi.json and openapi/openapi.yaml')
process.exit(0)
