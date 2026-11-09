import { randomInt } from 'node:crypto'
import dayjs from 'dayjs'

// The shape Investec's transfermultiple and paymultiple endpoints return:
// { data: { TransferResponses: [...], ErrorMessage: null } }, one entry per
// transfer or payment. Field names are Investec's (PascalCase).

export interface TransferResult {
  PaymentReferenceNumber: string
  PaymentDate: string
  Status: string
  BeneficiaryName: string
  BeneficiaryAccountId: string
  AuthorisationRequired: boolean
}

// Like Investec's references, e.g. UBP2201761367.
function paymentReference(): string {
  return `UBP${String(randomInt(0, 10_000_000_000)).padStart(10, '0')}`
}

export function transferResult(beneficiaryName: string, beneficiaryAccountId: string): TransferResult {
  const date = dayjs().format('DD/MM/YYYY')
  return {
    PaymentReferenceNumber: paymentReference(),
    PaymentDate: date,
    // The sandbox never needs authorisation (no multi-user access setup).
    Status: `- No authorisation necessary <BR> - Payment/Transfer effective date ${date}`,
    BeneficiaryName: beneficiaryName,
    BeneficiaryAccountId: beneficiaryAccountId,
    AuthorisationRequired: false,
  }
}

export function transferResponses(results: TransferResult[]) {
  return { TransferResponses: results, ErrorMessage: null }
}
