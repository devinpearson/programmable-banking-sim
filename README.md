## Installation

# Investec Programmable Banking Stateful Sandbox

A Node.js server to get everyone building and demoing regardless whether you have an account.

![GitHub](https://img.shields.io/github/license/devinpearson/programmable-banking-sim)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=round-square)](https://github.com/devinpearson/programmable-banking-sim/pulls)

![Dashboard view](/images/dashboard.png)

### Installation
Before installing, [download and install Node.js](https://nodejs.org/en/download/).

```bash
git clone https://github.com/devinpearson/programmable-banking-sim.git
cd programmable-banking-sim
```
```bash
npm install
```

### Usage
To start the simulator, run the following
```bash
npm run dev
```

[<img src="https://run.pstmn.io/button.svg" alt="Run In Postman" style="width: 128px; height: 32px;">](https://god.gw.postman.com/run-collection/26868804-62ce3cf6-3d98-4f62-ad82-b912b9826d51?action=collection%2Ffork&source=rip_markdown&collection-url=entityId%3D26868804-62ce3cf6-3d98-4f62-ad82-b912b9826d51%26entityType%3Dcollection%26workspaceId%3D37bb2e58-4709-4bd4-8b2c-b00fe7445371#?env%5BSim%5D=W3sia2V5IjoiY2FyZGtleSIsInZhbHVlIjoiIiwidHlwZSI6InNlY3JldCIsImVuYWJsZWQiOnRydWV9LHsia2V5IjoiYWNjb3VudElkIiwidmFsdWUiOiI0Njc1Nzc4MTI5OTEwMTg5NjAwMDAwMDAzIiwidHlwZSI6ImRlZmF1bHQiLCJlbmFibGVkIjp0cnVlfSx7ImtleSI6ImJlbmVmaWNpYXJ5SWQiLCJ2YWx1ZSI6Ik1UQXhPVEEyT1RJNU56MzBNak09IiwidHlwZSI6ImRlZmF1bHQiLCJlbmFibGVkIjp0cnVlfSx7ImtleSI6ImNsaWVudF9pZCIsInZhbHVlIjoiIiwidHlwZSI6InNlY3JldCIsImVuYWJsZWQiOnRydWV9LHsia2V5IjoiY2xpZW50X3NlY3JldCIsInZhbHVlIjoiIiwidHlwZSI6InNlY3JldCIsImVuYWJsZWQiOnRydWV9LHsia2V5IjoiYXBpX2tleSIsInZhbHVlIjoiIiwidHlwZSI6InNlY3JldCIsImVuYWJsZWQiOnRydWV9LHsia2V5IjoidG9rZW4iLCJ2YWx1ZSI6IiIsInR5cGUiOiJkZWZhdWx0IiwiZW5hYmxlZCI6dHJ1ZX0seyJrZXkiOiJob3N0IiwidmFsdWUiOiJsb2NhbGhvc3Q6MzAwMCIsInR5cGUiOiJkZWZhdWx0IiwiZW5hYmxlZCI6dHJ1ZX1d)

This will start the simulator on http://localhost:3000

Accessing the room of the domain will show the dashboard view of the server. The dashboard allows you to set the environment variables for the server and view the logs of the server.

There are helpful links to the Investec docs, Community wiki, GitHub repo and the Postman collection.

Supported endpoints

Dashboard
- / - Dashboard view

Auth
- /identity/v2/oauth2/token

Accounts
- /za/pb/v1/accounts
- /za/pb/v1/accounts/:accountId/balance
- /za/pb/v1/accounts/:accountId/transactions
- /za/pb/v1/accounts/beneficiaries

Cards
- /za/v1/cards/countries
- /za/v1/cards/currencies
- /za/v1/cards/merchants
- /za/v1/cards
- /za/v1/cards/:cardKey/code
- /za/v1/cards/:cardKey/publishedcode
- /za/v1/cards/:cardKey/code/execute
- /za/v1/cards/:cardKey/code/executions
- /za/v1/cards/:cardKey/environmentvariables
- /za/v1/cards/:cardKey/toggle-programmable-feature


Mock API only endpoints
- POST /za/pb/v1/accounts/:accountId/transactions - Creates and inserts a transaction into the history
- DELETE /za/pb/v1/accounts/:accountId/transactions/2023-01-22 - Deletes transactions from account for a particular postingDate
- POST /za/pb/v1/accounts - Create a new account
- DELETE /za/pb/v1/accounts/:accountId - Deletes the account and its transactions
- POST /za/v1/cards/:cardKey/code/execute-live - Used for the POS to execute the code on the card
Programmable documentation can be found here: https://developer.investec.com/programmable-banking/

[![Deploy to DO](https://www.deploytodo.com/do-btn-blue.svg)](https://cloud.digitalocean.com/apps/new?repo=https://github.com/devinpearson/programmable-banking-sim/tree/update-dockerfile)
