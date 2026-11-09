import { app, routerMounts } from '../app.js'

// Every route the API mounts, as "method path" in Express syntax, read from
// the live Express routers. The OpenAPI check compares it with the document.

// Express 5 has no single "all" marker; a route answering this many
// methods came from app.all() / router.all().
const ALL_METHODS_THRESHOLD = 20

interface RouteLayer {
  route?: { path: string; methods: Record<string, boolean> }
}

function routesOf(stack: RouteLayer[], prefix: string): string[] {
  return stack.flatMap(layer => {
    if (!layer.route) return []
    const path = prefix + (layer.route.path === '/' && prefix ? '' : layer.route.path)
    const methods = Object.keys(layer.route.methods)
    // app.all() registers every HTTP method; report it as one 'all' route.
    if (methods.includes('_all') || methods.length >= ALL_METHODS_THRESHOLD) return [`all ${path}`]
    return methods.map(method => `${method} ${path}`)
  })
}

export function mountedRoutes(): string[] {
  const appStack = (app as unknown as { router: { stack: RouteLayer[] } }).router.stack
  const nested = Object.entries(routerMounts).flatMap(([prefix, router]) =>
    routesOf((router as unknown as { stack: RouteLayer[] }).stack, prefix),
  )
  return [...routesOf(appStack, ''), ...nested]
}
