import type { NextFunction, Request, Response } from 'express'
import { PrismaClient } from '@prisma/client'
import { emitSocketEvent, formatErrorResponse, logRequest } from './app.js'

const prisma = new PrismaClient()

// Fault injection: make the emulated bank misbehave on purpose, so apps can
// be tested against errors, rate limits, timeouts and slow responses.
// Applies to /za and the token endpoint (see app.ts); never to the sandbox's
// own controls, so faults can always be turned off.

const FAULT_STATUSES = [429, 500, 502, 503, 504] as const
type FaultStatus = (typeof FAULT_STATUSES)[number]

const STATUS_TEXT: Record<FaultStatus, string> = {
  429: 'Too Many Requests',
  500: 'Internal Server Error',
  502: 'Bad Gateway',
  503: 'Service Unavailable',
  504: 'Gateway Timeout',
}

// How long a "timeout" holds the request before dropping the connection.
const DEFAULT_TIMEOUT_MS = 30_000
const MAX_TIMEOUT_MS = 120_000
const MAX_LATENCY_MS = 60_000

export interface FaultConfig {
  // Percent of requests (0–100) answered with errorStatus.
  errorRate: number
  errorStatus: FaultStatus
  // Percent of requests (0–100) held, then dropped.
  timeoutRate: number
  // Added to every matching request.
  latencyMs: number
  // Only requests whose path starts with this ('' = all of them).
  pathPrefix: string
}

export const NO_FAULTS: FaultConfig = {
  errorRate: 0,
  errorStatus: 503,
  timeoutRate: 0,
  latencyMs: 0,
  pathPrefix: '',
}

const SETTING = 'faults'
let config: FaultConfig = { ...NO_FAULTS }

export function getFaultConfig(): FaultConfig {
  return config
}

export function faultsActive(c: FaultConfig = config) {
  return c.errorRate > 0 || c.timeoutRate > 0 || c.latencyMs > 0
}

// Saved in the Setting table so faults survive a restart.
export async function loadFaultConfig() {
  const row = await prisma.setting.findUnique({ where: { name: SETTING } })
  if (row) {
    try {
      config = { ...NO_FAULTS, ...JSON.parse(row.value) }
    } catch {
      config = { ...NO_FAULTS }
    }
  }
}

export async function saveFaultConfig(next: FaultConfig) {
  config = next
  const value = JSON.stringify(next)
  await prisma.setting.upsert({ where: { name: SETTING }, update: { value }, create: { name: SETTING, value } })
  // Dashboards show a banner while faults are on, whoever changed them.
  emitSocketEvent('faults', { ...config, active: faultsActive(config) })
  return config
}

type Fault = { kind: 'status'; status: FaultStatus } | { kind: 'timeout'; holdMs: number } | { kind: 'reset' }

// X-Sandbox-Fault: 429 | 500 | 502 | 503 | 504 | timeout | timeout:<ms> | reset
function parseFaultHeader(value: string): Fault | null {
  const v = value.trim().toLowerCase()
  const status = Number(v)
  if ((FAULT_STATUSES as readonly number[]).includes(status)) return { kind: 'status', status: status as FaultStatus }
  if (v === 'reset') return { kind: 'reset' }
  if (v === 'timeout') return { kind: 'timeout', holdMs: DEFAULT_TIMEOUT_MS }
  const match = v.match(/^timeout:(\d+)$/)
  if (match && Number(match[1]) <= MAX_TIMEOUT_MS) return { kind: 'timeout', holdMs: Number(match[1]) }
  return null
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

// The dashboard marks its requests so random faults don't break it while
// you test your own app; explicit X-Sandbox-Fault headers still apply.
function fromDashboard(req: Request) {
  return req.get('x-sandbox-client') === 'dashboard'
}

function pathOf(req: Request) {
  return req.originalUrl.split('?')[0]
}

function rolled(percent: number) {
  return percent > 0 && Math.random() * 100 < percent
}

export async function injectFaults(req: Request, res: Response, next: NextFunction) {
  const faultHeader = req.get('x-sandbox-fault')
  const latencyHeader = req.get('x-sandbox-latency')

  let fault: Fault | null = null
  if (faultHeader !== undefined) {
    fault = parseFaultHeader(faultHeader)
    if (!fault) {
      return formatErrorResponse(
        req,
        res,
        400,
        `X-Sandbox-Fault must be one of ${FAULT_STATUSES.join(', ')}, timeout, timeout:<ms up to ${MAX_TIMEOUT_MS}> or reset`,
      )
    }
  }
  let latencyMs = 0
  if (latencyHeader !== undefined) {
    latencyMs = Number(latencyHeader)
    if (!Number.isInteger(latencyMs) || latencyMs < 0 || latencyMs > MAX_LATENCY_MS) {
      return formatErrorResponse(req, res, 400, `X-Sandbox-Latency must be milliseconds from 0 to ${MAX_LATENCY_MS}`)
    }
  }

  // Random faults from the saved config, unless the request chose its own.
  if (!fromDashboard(req) && faultsActive() && pathOf(req).startsWith(config.pathPrefix)) {
    if (latencyHeader === undefined) latencyMs = config.latencyMs
    if (!fault && rolled(config.timeoutRate)) fault = { kind: 'timeout', holdMs: DEFAULT_TIMEOUT_MS }
    if (!fault && rolled(config.errorRate)) fault = { kind: 'status', status: config.errorStatus }
  }

  if (latencyMs > 0) await sleep(latencyMs)
  if (!fault) return next()

  if (fault.kind === 'status') {
    res.setHeader('X-Sandbox-Fault-Injected', String(fault.status))
    if (fault.status === 429) res.setHeader('Retry-After', '1')
    return formatErrorResponse(req, res, fault.status, `Simulated fault: ${fault.status} ${STATUS_TEXT[fault.status]}`)
  }
  if (fault.kind === 'reset') {
    logRequest(req, 'connection reset (fault: reset)')
    req.socket.destroy()
    return
  }
  // Timeout: answer nothing, then drop the connection.
  logRequest(req, `no response, dropping after ${fault.holdMs} ms (fault: timeout)`)
  const timer = setTimeout(() => req.socket.destroy(), fault.holdMs)
  req.socket.once('close', () => clearTimeout(timer))
}
