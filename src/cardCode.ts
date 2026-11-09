import { randomInt } from 'node:crypto'

// Published/saved code for new and scenario cards: the same starter template
// the seeded card has. It approves every transaction and logs each step.
export const STARTER_CARD_CODE =
  '// This function runs before a transaction.\n' +
  'const beforeTransaction = async (authorization) => {\n' +
  '  console.log(authorization);\n' +
  '};\n' +
  '// This function runs after a transaction was successful.\n' +
  'const afterTransaction = async (transaction) => {\n' +
  '  console.log(transaction);\n' +
  '};\n' +
  '// This function runs after a transaction was declined.\n' +
  'const afterDecline = async (transaction) => {\n' +
  '  console.log(transaction);\n' +
  '};'

// A masked card number in the seeded card's format, e.g. 402167XXXXXX4821.
export function generateCardNumber(): string {
  return `402167XXXXXX${String(randomInt(0, 10000)).padStart(4, '0')}`
}
