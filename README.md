## Installation

# Investec Programmable Banking Open API Simulator

A nodejs server to get eveyone building and demoing regardless whether you have an account.

![GitHub](https://img.shields.io/github/license/devinpearson/programmable-banking-sim)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=round-square)](https://github.com/devinpearson/programmable-banking-sim/pulls)

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
npm start
```

This will start the simulator on http://localhost:3000

Supported endpoints

Auth
- /identity/v2/oauth2/token

Accounts
- /za/pb/v1/accounts
- /za/pb/v1/accounts/:accountId/balance
- /za/pb/v1/accounts/:accountId/transactions

Cards
- /za/v1/cards/countries
- /za/v1/cards/currencies
- /za/v1/cards/merchants

Programmable documentation can be found here: https://developer.investec.com/programmable-banking/