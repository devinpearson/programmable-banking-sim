/**
 * Fails when the OpenAPI document and the API disagree: a mounted route
 * missing from the document, a documented route that isn't mounted, an
 * invalid document, or stale files in openapi/. Run: npm run openapi:check
 */
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import SwaggerParser from '@apidevtools/swagger-parser'
import YAML from 'yaml'
import { UNDOCUMENTED_ROUTES, openApiDocument, toOpenApiPath } from '../config/openapi.js'
import { mountedRoutes } from '../config/routeInventory.js'

async function main() {
  const mounted = new Set(mountedRoutes().filter(route => !UNDOCUMENTED_ROUTES.has(route)))
  const documented = new Set(
    Object.entries(openApiDocument.paths ?? {}).flatMap(([routePath, operations]) =>
      Object.keys(operations ?? {}).map(method => `${method} ${routePath}`),
    ),
  )
  const mountedAsOpenApi = new Set(
    [...mounted].map(route => {
      const [method, routePath] = route.split(' ')
      return `${method} ${toOpenApiPath(routePath)}`
    }),
  )

  for (const route of mountedAsOpenApi) {
    assert(documented.has(route), `Mounted route is missing from OpenAPI: ${route}`)
  }
  for (const route of documented) {
    assert(mountedAsOpenApi.has(route), `OpenAPI documents a route that is not mounted: ${route}`)
  }

  const outDir = path.join(process.cwd(), 'openapi')
  const jsonPath = path.join(outDir, 'openapi.json')
  const yamlPath = path.join(outDir, 'openapi.yaml')
  assert(fs.existsSync(jsonPath), 'openapi/openapi.json is missing: run npm run openapi:generate')
  assert(fs.existsSync(yamlPath), 'openapi/openapi.yaml is missing: run npm run openapi:generate')
  const expected = JSON.parse(JSON.stringify(openApiDocument))
  assert.deepEqual(JSON.parse(fs.readFileSync(jsonPath, 'utf-8')), expected, 'openapi/openapi.json is stale: run npm run openapi:generate')
  assert.deepEqual(YAML.parse(fs.readFileSync(yamlPath, 'utf-8')), expected, 'openapi/openapi.yaml is stale: run npm run openapi:generate')
  await SwaggerParser.validate(jsonPath)

  console.log(`OpenAPI check passed for ${mounted.size} documented routes.`)
}

main()
  .then(() => process.exit(0))
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error)
    process.exit(1)
  })
