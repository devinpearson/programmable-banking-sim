import dayjs from 'dayjs'
import { PrismaClient, type Schedule, type Transaction } from '@prisma/client'
import { emitDatabaseSummary } from './app.js'
import { getAccountBalance } from './balance.js'
import { CARD_TRANSACTION_TYPES, TransactionStatus, TransactionType } from './types.js'
import { publish } from './webhooks.js'

const prisma = new PrismaClient()

// What happens as sandbox days pass: recurring transactions (schedules) run
// on their dates, and card holds settle a few days after the swipe. Run for
// a date with runDueUpTo(); everything due is processed in date order, so
// interest is worked out on the balance as it stood that day.

// Card purchases settle this many days after the swipe.
const HOLD_SETTLE_DAYS = 3

const FORMAT = 'YYYY-MM-DD'

// The first date on or after `from` that a schedule runs.
export function firstRunOnOrAfter(
  schedule: Pick<Schedule, 'frequency' | 'dayOfMonth' | 'dayOfWeek'>,
  from: string,
): string {
  const start = dayjs(from)
  if (schedule.frequency === 'weekly') {
    const ahead = ((schedule.dayOfWeek ?? 0) - start.day() + 7) % 7
    return start.add(ahead, 'day').format(FORMAT)
  }
  // Monthly: dayOfMonth in this month (clamped to its last day), or next month.
  const inMonth = (month: dayjs.Dayjs) => month.date(Math.min(schedule.dayOfMonth ?? 1, month.daysInMonth()))
  const thisMonth = inMonth(start.startOf('month'))
  return (thisMonth.isBefore(start, 'day') ? inMonth(start.startOf('month').add(1, 'month')) : thisMonth).format(FORMAT)
}

// The run after `date`.
function nextRunAfter(schedule: Schedule, date: string): string {
  return firstRunOnOrAfter(schedule, dayjs(date).add(1, 'day').format(FORMAT))
}

function postedOn(date: string) {
  return { status: TransactionStatus.POSTED, postingDate: date, valueDate: date, actionDate: date }
}

// The transaction one run of a schedule posts, or null (e.g. no interest on
// a zero balance).
async function runSchedule(schedule: Schedule, date: string): Promise<Transaction | null> {
  let type = schedule.type
  let amount = schedule.amount?.toNumber() ?? 0
  let description = schedule.description
  if (schedule.kind === 'interest') {
    const balance = (await getAccountBalance(schedule.accountId))?.currentBalance ?? 0
    const rate = schedule.annualRatePercent?.toNumber() ?? 0
    amount = Math.round(Math.abs(balance) * (rate / 100 / 12) * 100) / 100
    if (amount === 0) return null
    // Interest earned on a positive balance; charged on an overdrawn one.
    type = balance >= 0 ? TransactionType.CREDIT : TransactionType.DEBIT
    description = `${schedule.description} (${rate}% a year)`
  }
  return prisma.transaction.create({
    data: {
      accountId: schedule.accountId,
      type,
      transactionType: schedule.transactionType,
      description,
      cardNumber: '',
      postedOrder: 0,
      transactionDate: date,
      amount,
      runningBalance: 0,
      ...postedOn(date),
    },
  })
}

type Due =
  | { kind: 'schedule'; date: string; schedule: Schedule }
  | { kind: 'hold'; date: string; hold: Transaction }

async function nextDue(upTo: string): Promise<Due | null> {
  const [schedule, holds] = await Promise.all([
    prisma.schedule.findFirst({
      where: { active: true, nextRunDate: { lte: upTo } },
      orderBy: [{ nextRunDate: 'asc' }, { createdAt: 'asc' }],
    }),
    prisma.transaction.findMany({
      where: { status: TransactionStatus.PENDING, transactionType: { in: CARD_TRANSACTION_TYPES } },
      orderBy: [{ transactionDate: 'asc' }, { transactionId: 'asc' }],
    }),
  ])
  const hold = holds
    .map(h => ({ hold: h, date: dayjs(h.transactionDate).add(HOLD_SETTLE_DAYS, 'day').format(FORMAT) }))
    .find(h => h.date <= upTo)
  const candidates: Due[] = []
  if (schedule) candidates.push({ kind: 'schedule', date: schedule.nextRunDate, schedule })
  if (hold) candidates.push({ kind: 'hold', date: hold.date, hold: hold.hold })
  candidates.sort((a, b) => a.date.localeCompare(b.date))
  return candidates[0] ?? null
}

// A safety stop: a decade of daily schedules is far more than any test needs.
const MAX_RUNS = 20_000

export interface RunSummary {
  posted: number
  settled: number
}

// Process everything due on or before `upTo` (a YYYY-MM-DD sandbox date).
export async function runDueUpTo(upTo: string): Promise<RunSummary> {
  const summary: RunSummary = { posted: 0, settled: 0 }
  for (let i = 0; i < MAX_RUNS; i++) {
    const due = await nextDue(upTo)
    if (!due) break
    if (due.kind === 'schedule') {
      const transaction = await runSchedule(due.schedule, due.date)
      await prisma.schedule.update({
        where: { scheduleId: due.schedule.scheduleId },
        data: { nextRunDate: nextRunAfter(due.schedule, due.date) },
      })
      if (transaction) {
        summary.posted++
        publish('transaction.posted', transaction)
      }
    } else {
      const settled = await prisma.transaction.update({
        where: { transactionId: due.hold.transactionId },
        data: postedOn(due.date),
      })
      summary.settled++
      publish('transaction.posted', settled)
    }
  }
  if (summary.posted > 0 || summary.settled > 0) await emitDatabaseSummary()
  return summary
}
