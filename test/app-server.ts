import { app as expressApp } from '../src/app'

// Test files import `app` from here instead of src/app, and pass it to
// supertest's request(). It is a server already listening on 127.0.0.1.
//
// Given a bare Express app, supertest starts a new server on a random port
// for every request, listening on all interfaces. macOS lets that wildcard
// bind share a port another program has bound to 127.0.0.1, and loopback
// requests then reach the other program: tests failed at random with 404s
// from routes that exist, "Parse Error", or "socket hang up". Binding to
// 127.0.0.1 makes the OS hand out only a port nothing else holds there, and
// one server per file means no per-request ports at all.
//
// The listen must finish before any request: with a host, listen() is async,
// and supertest treats a server without an address as not started — it would
// call listen(0) on it itself (wildcard again) and close it after the request.
export const app = expressApp.listen(0, '127.0.0.1')
await new Promise<void>((resolve, reject) => {
  app.once('listening', () => resolve())
  app.once('error', reject)
})

afterAll(() => new Promise<void>(resolve => app.close(() => resolve())))
