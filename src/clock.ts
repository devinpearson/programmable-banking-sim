import dayjs from 'dayjs'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// The sandbox clock: a whole number of days ahead of the real date, so a
// month of salary, debit orders and settling card holds can be tested in
// seconds (POST /clock/advance). Every banking date uses it; token expiry
// and logs stay on real time. Saved across restarts.

const SETTING = 'clock'
let offsetDays = 0

// Told about every change (app.ts broadcasts it to dashboards). A listener
// rather than an import of app.ts, which would make a module cycle.
type Listener = (clock: ReturnType<typeof getClock>) => void
let listener: Listener = () => {}

export function onClockChange(fn: Listener) {
  listener = fn
}

// "Now" for banking purposes: the real time, shifted by the offset.
export function sandboxToday(): dayjs.Dayjs {
  return dayjs().add(offsetDays, 'day')
}

export function sandboxDate(): string {
  return sandboxToday().format('YYYY-MM-DD')
}

export function getClock() {
  return {
    today: sandboxDate(),
    realToday: dayjs().format('YYYY-MM-DD'),
    offsetDays,
  }
}

export async function loadClock() {
  const row = await prisma.setting.findUnique({ where: { name: SETTING } })
  const saved = row ? Number(JSON.parse(row.value).offsetDays) : 0
  offsetDays = Number.isInteger(saved) && saved >= 0 ? saved : 0
}

export async function setOffsetDays(days: number) {
  offsetDays = days
  const value = JSON.stringify({ offsetDays })
  await prisma.setting.upsert({ where: { name: SETTING }, update: { value }, create: { name: SETTING, value } })
  listener(getClock())
  return getClock()
}
