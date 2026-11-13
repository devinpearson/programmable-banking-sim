# Changelog

Notable changes to the Programmable Banking Sandbox. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); numbers in brackets are pull requests.

## [Unreleased]

Everything since v1.3. Most of it landed between 3 and 9 November 2026.

### Added

**Banking behaviour**
- Card holds: card swipes go to pending as holds. You can settle or reverse them, and they settle automatically three days after the swipe. Other transactions post straight away, and card transactions added through the management API can skip the hold (#37, #40, #53)
- Overdraft limits, and "Insufficient funds" for payments past the available balance (#40)
- A realistic ledger: transaction types, date ordering, running balances, beneficiaries, and cards in each scenario (#41)
- Swipes in any currency, using editable exchange rates (#47, #52)
- Time travel: a sandbox date you can move forward (`/clock`), and recurring transactions such as salary, debit orders and monthly interest (`/schedules`). Scenarios come with them (#53)
- Profiles, and KYC and profile fields on accounts (#26, #51)

**Investec API coverage**
- Beneficiary categories and account documents (statements) (#36, #51)
- Responses that match the real Investec API for transfers, payments and profiles (#51)

**OAuth (3-legged)**
- The authorization code flow: authorize, sign in, consent, and code, token and refresh exchange (#21)
- Consent is enforced: tokens only reach the accounts and scopes the user approved, and `state` is passed back to the app (#35, #42)
- An OAuth tester page at `/oauth`: start the flow, check `state`, exchange the code, refresh the tokens and call the API with the token (#56)
- `response_type=code` is accepted, matching Investec's 3-legged Postman collection, and a flow started from Postman can be finished in the tester (#58)

**Testing tools**
- Webhooks for posted transactions, holds, reversals and card authorisations, with HMAC signatures, retries and a delivery log (#49, #52)
- Fault injection: simulated errors (429/5xx), timeouts, connection resets and added latency, at random or on a single request via headers. The dashboard is exempt (#50)
- Export the whole sandbox as JSON and import it again (#52)
- Scenarios (ready-made data sets) and account top-ups (#34)
- `GET /health`, and live database totals over Socket.IO (#30)
- Postman collections for the sandbox

**Dashboard**
- Transaction history with filters, beneficiary payments, adding cards, the exchange-rate editor and a Time panel (#47, #48, #52, #53)
- The dashboard keeps working with authentication on, using its own token (#52)
- Client secret and API key are hidden until shown (#30)

### Changed
- The dashboard and OAuth pages were rebuilt in Next.js 15, React 19 and Tailwind v4, on their own server (port 3001) (#45)
- The dashboard has three tabs (Banking, Simulate, Sandbox), and its forms stay folded until opened. Totals are one line, and Clear, Export and Import moved into a More menu (#57)
- The API moved to Express 5 with zod validation, and the OpenAPI spec is now generated from the code. Sandbox-only endpoints and webhook events are marked `x-sandbox-only` (#46, #55)
- The code was split into separate route files (#20)
- Cascade deletes and foreign-key indexes in the database (#33)
- Tooling: Biome linting, knip and Stryker mutation testing

### Fixed
- Correctness bugs in transfers, payments and restore (#32)
- OAuth: the switch to a Map for pending sign-ins was finished (#39)
- Flaky tests: each test file gets its own loopback server, and tests use a separate database (#31, #43, #44)
- Seed files can be run again without duplicating data; lint, knip and CI pass (#31, #38)

### Removed
- Database switching (`DB_FILE`) (#24)
- The Azure Container Apps deploy workflows (#54)

## [1.3] - 2024-08-15

### Added
- Card endpoints: cards, saved and published card code, code execution (simulated and live), environment variables, the programmable toggle, and countries, currencies and merchants (#12, #14)
- Mocha tests (#13)

## [1.2] - 2024-07-19

### Added
- More database controls on the dashboard (#11)

## [1.1] - 2024-06-09

### Added
- A dashboard with server logs and environment settings (#8)
- Database controls and a Quick Start guide (#9)
- Beneficiaries with generated sample data
- Prisma and TypeScript (#2), request logging with morgan (#3), and error handling

[Unreleased]: https://github.com/devinpearson/programmable-banking-sim/compare/v1.3...HEAD
[1.3]: https://github.com/devinpearson/programmable-banking-sim/compare/v1.2...v1.3
[1.2]: https://github.com/devinpearson/programmable-banking-sim/compare/v1.1...v1.2
[1.1]: https://github.com/devinpearson/programmable-banking-sim/releases/tag/v1.1
