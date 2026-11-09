import request from 'supertest'
import { app } from '../src/app'
import { assert } from 'chai'

const TEST_ACCOUNT_ID = 'test-account-create-delete-001'

describe('Test the accounts', () => {
  beforeAll(async () => {
    await request(app).delete(`/za/pb/v1/accounts/${TEST_ACCOUNT_ID}`)
  })
  it('should respond with the accounts list', async () => {
    const response = await request(app).get('/za/pb/v1/accounts')
    assert.equal(response.statusCode, 200)
    assert.deepEqual(response.body.data.accounts[3], {
      accountId: '4675778129910189600000006',
      accountNumber: '10012420006',
      accountName: 'Mr J Soap',
      referenceName: 'Mr J Soap',
      productName: 'Mortgage Loan Account',
      kycCompliant: true,
      profileId: '10001234567890',
      profileName: 'Joe Soap',
    })
  })

  it('should respond with the account balance', async () => {
    const response = await request(app).get(
      '/za/pb/v1/accounts/4675778129910189600000003/balance',
    )
    assert.equal(response.statusCode, 200)
    assert.deepEqual(response.body.data, {
      accountId: '4675778129910189600000003',
      currentBalance: -35696.04,
      availableBalance: -35696.04,
      currency: 'ZAR',
    })
  })

  it('should respond with 404 for invalid account on balance', async () => {
    const response = await request(app).get(
      '/za/pb/v1/accounts/4675778129910189600000009/balance',
    )
    assert.equal(response.statusCode, 404)
  })

  it('should respond with transactions', async () => {
    const response = await request(app).get(
      '/za/pb/v1/accounts/4675778129910189600000003/transactions?fromDate=2022-11-01',
    )
    assert.equal(response.statusCode, 200)
    assert.deepEqual(response.body.data.transactions[0], {
      accountId: '4675778129910189600000003',
      type: 'DEBIT',
      transactionType: 'CardPurchases',
      status: 'POSTED',
      description: 'HTTP://WWW.UBEREATS.CO PARKTOWN NOR ZA',
      cardNumber: '402167xxxxxx9999',
      postedOrder: '1',
      postingDate: '2023-01-22',
      valueDate: '2022-05-15',
      actionDate: '2022-04-24',
      transactionDate: '2022-04-21',
      amount: '40.99',
      runningBalance: '-40.99',
    })
  })

  it('should respond with 404 for invalid account on transactions', async () => {
    const response = await request(app).get(
      '/za/pb/v1/accounts/4675778129910189600000009/transactions',
    )
    assert.equal(response.statusCode, 404)
  })

  it('should create and delete an account', async () => {
    const accountId = TEST_ACCOUNT_ID
    const createResponse = await request(app)
      .post('/za/pb/v1/accounts')
      .send({ accountId, accountNumber: '99999999999' })
    assert.equal(createResponse.statusCode, 200)
    assert.equal(createResponse.body.data.accountId, accountId)

    const duplicateResponse = await request(app)
      .post('/za/pb/v1/accounts')
      .send({ accountId, accountNumber: '99999999999' })
    assert.equal(duplicateResponse.statusCode, 409)

    const deleteResponse = await request(app).delete(
      `/za/pb/v1/accounts/${accountId}`,
    )
    assert.equal(deleteResponse.statusCode, 200)
  })

  it('should respond with 404 when deleting a non-existent account', async () => {
    const response = await request(app).delete(
      '/za/pb/v1/accounts/does-not-exist',
    )
    assert.equal(response.statusCode, 404)
  })

  it('should create a transaction and reflect it in the balance', async () => {
    const accountId = 'test-account-tx-balance-001'
    await request(app).delete(`/za/pb/v1/accounts/${accountId}`)
    await request(app).post('/za/pb/v1/accounts').send({ accountId, accountNumber: '88888888888' })

    const creditResponse = await request(app)
      .post(`/za/pb/v1/accounts/${accountId}/transactions`)
      .send({ type: 'CREDIT', amount: 1000, postingDate: '2024-01-01', valueDate: '2024-01-01', actionDate: '2024-01-01', transactionDate: '2024-01-01' })
    assert.equal(creditResponse.statusCode, 200)

    const balanceAfterCredit = await request(app).get(`/za/pb/v1/accounts/${accountId}/balance`)
    assert.equal(balanceAfterCredit.statusCode, 200)
    assert.equal(balanceAfterCredit.body.data.currentBalance, 1000)

    const debitResponse = await request(app)
      .post(`/za/pb/v1/accounts/${accountId}/transactions`)
      .send({ type: 'DEBIT', amount: 400, postingDate: '2024-01-02', valueDate: '2024-01-02', actionDate: '2024-01-02', transactionDate: '2024-01-02' })
    assert.equal(debitResponse.statusCode, 200)

    const balanceAfterDebit = await request(app).get(`/za/pb/v1/accounts/${accountId}/balance`)
    assert.equal(balanceAfterDebit.body.data.currentBalance, 600)

    await request(app).delete(`/za/pb/v1/accounts/${accountId}`)
  })

  it('should filter transactions by transactionType', async () => {
    const accountId = 'test-account-tx-filter-001'
    await request(app).delete(`/za/pb/v1/accounts/${accountId}`)
    await request(app).post('/za/pb/v1/accounts').send({ accountId, accountNumber: '77777777777' })
    await request(app).post(`/za/pb/v1/accounts/${accountId}/transactions`)
      .send({ type: 'DEBIT', transactionType: 'CardPurchases', amount: 100, postingDate: '2024-06-01', valueDate: '2024-06-01', actionDate: '2024-06-01', transactionDate: '2024-06-01' })
    await request(app).post(`/za/pb/v1/accounts/${accountId}/transactions`)
      .send({ type: 'DEBIT', transactionType: 'Transfer', amount: 50, postingDate: '2024-06-02', valueDate: '2024-06-02', actionDate: '2024-06-02', transactionDate: '2024-06-02' })

    const filtered = await request(app).get(
      `/za/pb/v1/accounts/${accountId}/transactions?transactionType=CardPurchases&fromDate=2024-01-01`,
    )
    assert.equal(filtered.statusCode, 200)
    assert.equal(filtered.body.data.transactions.length, 1)
    assert.equal(filtered.body.data.transactions[0].transactionType, 'CardPurchases')

    await request(app).delete(`/za/pb/v1/accounts/${accountId}`)
  })

  it('should filter transactions by toDate', async () => {
    const accountId = 'test-account-tx-todate-001'
    await request(app).delete(`/za/pb/v1/accounts/${accountId}`)
    await request(app).post('/za/pb/v1/accounts').send({ accountId, accountNumber: '66666666666' })
    await request(app).post(`/za/pb/v1/accounts/${accountId}/transactions`)
      .send({ type: 'DEBIT', amount: 100, postingDate: '2024-03-01', valueDate: '2024-03-01', actionDate: '2024-03-01', transactionDate: '2024-03-01' })
    await request(app).post(`/za/pb/v1/accounts/${accountId}/transactions`)
      .send({ type: 'DEBIT', amount: 200, postingDate: '2024-05-01', valueDate: '2024-05-01', actionDate: '2024-05-01', transactionDate: '2024-05-01' })

    const beforeApril = await request(app).get(
      `/za/pb/v1/accounts/${accountId}/transactions?fromDate=2024-01-01&toDate=2024-04-01`,
    )
    assert.equal(beforeApril.statusCode, 200)
    assert.equal(beforeApril.body.data.transactions.length, 1)
    assert.equal(beforeApril.body.data.transactions[0].postingDate, '2024-03-01')

    await request(app).delete(`/za/pb/v1/accounts/${accountId}`)
  })

  it('should delete transactions by posting date', async () => {
    const accountId = 'test-account-tx-delete-001'
    await request(app).delete(`/za/pb/v1/accounts/${accountId}`)
    await request(app).post('/za/pb/v1/accounts').send({ accountId, accountNumber: '55555555555' })
    await request(app).post(`/za/pb/v1/accounts/${accountId}/transactions`)
      .send({ type: 'DEBIT', amount: 100, postingDate: '2024-07-15', valueDate: '2024-07-15', actionDate: '2024-07-15', transactionDate: '2024-07-15' })

    const beforeDelete = await request(app).get(
      `/za/pb/v1/accounts/${accountId}/transactions?fromDate=2024-01-01`,
    )
    assert.equal(beforeDelete.body.data.transactions.length, 1)

    const deleteResponse = await request(app).delete(
      `/za/pb/v1/accounts/${accountId}/transactions/2024-07-15`,
    )
    assert.equal(deleteResponse.statusCode, 200)

    const afterDelete = await request(app).get(
      `/za/pb/v1/accounts/${accountId}/transactions?fromDate=2024-01-01`,
    )
    assert.equal(afterDelete.body.data.transactions.length, 0)

    await request(app).delete(`/za/pb/v1/accounts/${accountId}`)
  })

  it('should respond with 404 when deleting transactions for a non-existent account', async () => {
    const response = await request(app).delete(
      '/za/pb/v1/accounts/does-not-exist/transactions/2024-01-01',
    )
    assert.equal(response.statusCode, 404)
  })

  it('should transfermultiple between two accounts', async () => {
    const sourceId = 'test-transfer-source-001'
    const destId = 'test-transfer-dest-001'
    await request(app).delete(`/za/pb/v1/accounts/${sourceId}`)
    await request(app).delete(`/za/pb/v1/accounts/${destId}`)
    await request(app).post('/za/pb/v1/accounts').send({ accountId: sourceId, accountNumber: '44444444401' })
    await request(app).post('/za/pb/v1/accounts').send({ accountId: destId, accountNumber: '44444444402' })

    const response = await request(app)
      .post(`/za/pb/v1/accounts/${sourceId}/transfermultiple`)
      .send({
        transferList: [
          {
            beneficiaryAccountId: destId,
            amount: 500,
            myReference: 'Payment to dest',
            theirReference: 'Payment from source',
          },
        ],
      })
    assert.equal(response.statusCode, 200)
    assert.isArray(response.body.data)
    assert.equal(response.body.data.length, 1)

    const sourceBalance = await request(app).get(`/za/pb/v1/accounts/${sourceId}/balance`)
    assert.equal(sourceBalance.body.data.currentBalance, -500)

    const destBalance = await request(app).get(`/za/pb/v1/accounts/${destId}/balance`)
    assert.equal(destBalance.body.data.currentBalance, 500)

    await request(app).delete(`/za/pb/v1/accounts/${sourceId}`)
    await request(app).delete(`/za/pb/v1/accounts/${destId}`)
  })

  it('should respond with 404 when transfermultiple source account does not exist', async () => {
    const response = await request(app)
      .post('/za/pb/v1/accounts/does-not-exist/transfermultiple')
      .send({ transferList: [{ beneficiaryAccountId: '4675778129910189600000003', amount: 100, myReference: 'ref', theirReference: 'ref' }] })
    assert.equal(response.statusCode, 404)
  })

  it('should respond with 404 when transfermultiple beneficiary account does not exist', async () => {
    const accountId = 'test-transfer-nobene-001'
    await request(app).delete(`/za/pb/v1/accounts/${accountId}`)
    await request(app).post('/za/pb/v1/accounts').send({ accountId, accountNumber: '44444444403' })

    const response = await request(app)
      .post(`/za/pb/v1/accounts/${accountId}/transfermultiple`)
      .send({ transferList: [{ beneficiaryAccountId: 'does-not-exist', amount: 100, myReference: 'ref', theirReference: 'ref' }] })
    assert.equal(response.statusCode, 404)

    await request(app).delete(`/za/pb/v1/accounts/${accountId}`)
  })

  it('should paymultiple to a beneficiary', async () => {
    const accountId = 'test-pay-source-001'
    await request(app).delete(`/za/pb/v1/accounts/${accountId}`)
    await request(app).post('/za/pb/v1/accounts').send({ accountId, accountNumber: '33333333301' })

    const response = await request(app)
      .post(`/za/pb/v1/accounts/${accountId}/paymultiple`)
      .send({
        paymentList: [
          {
            beneficiaryId: 'MTAxOTA2OTI5Nzc0Mjz=',
            amount: 200,
            myReference: 'My ref',
          },
        ],
      })
    assert.equal(response.statusCode, 200)
    assert.isArray(response.body.data)
    assert.equal(response.body.data.length, 1)

    const balance = await request(app).get(`/za/pb/v1/accounts/${accountId}/balance`)
    assert.equal(balance.body.data.currentBalance, -200)

    await request(app).delete(`/za/pb/v1/accounts/${accountId}`)
  })

  it('should respond with 404 when paymultiple source account does not exist', async () => {
    const response = await request(app)
      .post('/za/pb/v1/accounts/does-not-exist/paymultiple')
      .send({ paymentList: [{ beneficiaryId: 'MTAxOTA2OTI5Nzc0Mjz=', amount: 100, myReference: 'ref' }] })
    assert.equal(response.statusCode, 404)
  })

  it('should respond with 404 when paymultiple beneficiary does not exist', async () => {
    const accountId = 'test-pay-nobene-001'
    await request(app).delete(`/za/pb/v1/accounts/${accountId}`)
    await request(app).post('/za/pb/v1/accounts').send({ accountId, accountNumber: '33333333302' })

    const response = await request(app)
      .post(`/za/pb/v1/accounts/${accountId}/paymultiple`)
      .send({ paymentList: [{ beneficiaryId: 'does-not-exist', amount: 100, myReference: 'ref' }] })
    assert.equal(response.statusCode, 404)

    await request(app).delete(`/za/pb/v1/accounts/${accountId}`)
  })

  it('should respond with 409 when creating a duplicate beneficiary', async () => {
    const beneficiaryId = 'test-bene-duplicate-001'
    await request(app).delete(`/za/pb/v1/accounts/beneficiaries/${beneficiaryId}`)

    await request(app).post('/za/pb/v1/accounts/beneficiaries').send({ beneficiaryId, beneficiaryName: 'Dup Test' })
    const dupResponse = await request(app).post('/za/pb/v1/accounts/beneficiaries').send({ beneficiaryId, beneficiaryName: 'Dup Test' })
    assert.equal(dupResponse.statusCode, 409)

    await request(app).delete(`/za/pb/v1/accounts/beneficiaries/${beneficiaryId}`)
  })

  it('should respond with 400 when transfermultiple has no transferList', async () => {
    const accountId = 'test-transfer-badinput-001'
    await request(app).delete(`/za/pb/v1/accounts/${accountId}`)
    await request(app).post('/za/pb/v1/accounts').send({ accountId, accountNumber: '44444444404' })

    const response = await request(app)
      .post(`/za/pb/v1/accounts/${accountId}/transfermultiple`)
      .send({})
    assert.equal(response.statusCode, 400)

    await request(app).delete(`/za/pb/v1/accounts/${accountId}`)
  })

  it('should respond with 400 when transfermultiple amount is invalid', async () => {
    const accountId = 'test-transfer-badamount-001'
    await request(app).delete(`/za/pb/v1/accounts/${accountId}`)
    await request(app).post('/za/pb/v1/accounts').send({ accountId, accountNumber: '44444444405' })

    const response = await request(app)
      .post(`/za/pb/v1/accounts/${accountId}/transfermultiple`)
      .send({ transferList: [{ beneficiaryAccountId: accountId, amount: -5, myReference: 'r', theirReference: 'r' }] })
    assert.equal(response.statusCode, 400)

    await request(app).delete(`/za/pb/v1/accounts/${accountId}`)
  })

  it('should not write any leg when a transfermultiple beneficiary is missing (atomicity)', async () => {
    const sourceId = 'test-transfer-atomic-001'
    const destId = 'test-transfer-atomic-dest-001'
    await request(app).delete(`/za/pb/v1/accounts/${sourceId}`)
    await request(app).delete(`/za/pb/v1/accounts/${destId}`)
    await request(app).post('/za/pb/v1/accounts').send({ accountId: sourceId, accountNumber: '44444444406' })
    await request(app).post('/za/pb/v1/accounts').send({ accountId: destId, accountNumber: '44444444407' })

    // First leg is valid, second points at a non-existent beneficiary.
    const response = await request(app)
      .post(`/za/pb/v1/accounts/${sourceId}/transfermultiple`)
      .send({
        transferList: [
          { beneficiaryAccountId: destId, amount: 100, myReference: 'r', theirReference: 'r' },
          { beneficiaryAccountId: 'does-not-exist', amount: 100, myReference: 'r', theirReference: 'r' },
        ],
      })
    assert.equal(response.statusCode, 404)

    // The valid first leg must NOT have been written.
    const sourceBalance = await request(app).get(`/za/pb/v1/accounts/${sourceId}/balance`)
    assert.equal(sourceBalance.body.data.currentBalance, 0)
    const destBalance = await request(app).get(`/za/pb/v1/accounts/${destId}/balance`)
    assert.equal(destBalance.body.data.currentBalance, 0)

    await request(app).delete(`/za/pb/v1/accounts/${sourceId}`)
    await request(app).delete(`/za/pb/v1/accounts/${destId}`)
  })

  it('should respond with 400 when paymultiple has no paymentList', async () => {
    const accountId = 'test-pay-badinput-001'
    await request(app).delete(`/za/pb/v1/accounts/${accountId}`)
    await request(app).post('/za/pb/v1/accounts').send({ accountId, accountNumber: '33333333303' })

    const response = await request(app)
      .post(`/za/pb/v1/accounts/${accountId}/paymultiple`)
      .send({})
    assert.equal(response.statusCode, 400)

    await request(app).delete(`/za/pb/v1/accounts/${accountId}`)
  })

  it('should label paymultiple transactions as Payment', async () => {
    const accountId = 'test-pay-label-001'
    await request(app).delete(`/za/pb/v1/accounts/${accountId}`)
    await request(app).post('/za/pb/v1/accounts').send({ accountId, accountNumber: '33333333304' })

    await request(app)
      .post(`/za/pb/v1/accounts/${accountId}/paymultiple`)
      .send({ paymentList: [{ beneficiaryId: 'MTAxOTA2OTI5Nzc0Mjz=', amount: 150, myReference: 'My ref' }] })

    const txns = await request(app).get(`/za/pb/v1/accounts/${accountId}/transactions?fromDate=2000-01-01`)
    assert.equal(txns.statusCode, 200)
    assert.equal(txns.body.data.transactions[0].transactionType, 'Payment')

    await request(app).delete(`/za/pb/v1/accounts/${accountId}`)
  })

  it('should cascade-delete an account\'s transactions, cards and card codes', async () => {
    const accountId = 'test-cascade-account-001'
    const cardKey = 'test-cascade-card-001'
    await request(app).delete(`/za/v1/cards/${cardKey}`)
    await request(app).delete(`/za/pb/v1/accounts/${accountId}`)
    await request(app).post('/za/pb/v1/accounts').send({ accountId, accountNumber: '55555555501' })

    // Give the account two transactions and a card.
    await request(app)
      .post(`/za/pb/v1/accounts/${accountId}/transactions`)
      .send({ type: 'CREDIT', amount: 100, postingDate: '2024-01-01', valueDate: '2024-01-01', actionDate: '2024-01-01', transactionDate: '2024-01-01' })
    await request(app)
      .post(`/za/pb/v1/accounts/${accountId}/transactions`)
      .send({ type: 'DEBIT', amount: 40, postingDate: '2024-01-02', valueDate: '2024-01-02', actionDate: '2024-01-02', transactionDate: '2024-01-02' })
    await request(app).post('/za/v1/cards').send({ cardKey, accountId })

    const cardCodeBefore = await request(app).get(`/za/v1/cards/${cardKey}/code`)
    assert.equal(cardCodeBefore.statusCode, 200)
    assert.exists(cardCodeBefore.body.data.cardCode)

    // Delete the account.
    const deleteResponse = await request(app).delete(`/za/pb/v1/accounts/${accountId}`)
    assert.equal(deleteResponse.statusCode, 200)

    // The card is gone...
    const cards = await request(app).get('/za/v1/cards')
    assert.isUndefined(cards.body.data.cards.find((c: { CardKey: string }) => c.CardKey === cardKey))
    // ...its code row is gone...
    const cardCodeAfter = await request(app).get(`/za/v1/cards/${cardKey}/code`)
    assert.equal(cardCodeAfter.statusCode, 404)
    // ...and the transactions did not survive (a fresh account of the same id is empty).
    await request(app).post('/za/pb/v1/accounts').send({ accountId, accountNumber: '55555555501' })
    const txns = await request(app).get(`/za/pb/v1/accounts/${accountId}/transactions?fromDate=2000-01-01`)
    assert.equal(txns.statusCode, 200)
    assert.equal(txns.body.data.transactions.length, 0)

    await request(app).delete(`/za/pb/v1/accounts/${accountId}`)
  })

  it('should list the beneficiary categories', async () => {
    const response = await request(app).get('/za/pb/v1/accounts/beneficiarycategories')
    assert.equal(response.statusCode, 200)
    assert.isArray(response.body.data)
    assert.isAbove(response.body.data.length, 0)
    const def = response.body.data.find((c: { isDefault: boolean }) => c.isDefault)
    assert.exists(def)
    assert.exists(def.categoryId)
    assert.exists(def.name)
  })

  it('should list an account\'s documents', async () => {
    const response = await request(app).get('/za/pb/v1/accounts/4675778129910189600000003/documents')
    assert.equal(response.statusCode, 200)
    assert.isArray(response.body.data.documents)
    assert.isAbove(response.body.data.documents.length, 0)
    assert.equal(response.body.data.documents[0].documentType, 'Statement')
    assert.exists(response.body.data.documents[0].documentDate)
  })

  it('should respond with 404 listing documents for an unknown account', async () => {
    const response = await request(app).get('/za/pb/v1/accounts/does-not-exist/documents')
    assert.equal(response.statusCode, 404)
  })

  it('should fetch a specific document for an account', async () => {
    const response = await request(app).get(
      '/za/pb/v1/accounts/4675778129910189600000003/documents/Statement/2024-01-31',
    )
    assert.equal(response.statusCode, 200)
    assert.equal(response.body.data.documentType, 'Statement')
    assert.equal(response.body.data.documentDate, '2024-01-31')
    assert.exists(response.body.data.fileName)
  })

  it('should respond with 404 fetching a document for an unknown account', async () => {
    const response = await request(app).get(
      '/za/pb/v1/accounts/does-not-exist/documents/Statement/2024-01-31',
    )
    assert.equal(response.statusCode, 404)
  })
})
