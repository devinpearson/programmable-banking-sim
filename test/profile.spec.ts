import request from 'supertest'
import { app } from '../src/app'
import { assert } from 'chai'

describe('Test the profiles', () => {
  it('should respond with the database summary including profile count', async () => {
    const response = await request(app).get('/database-summary')
    assert.equal(response.statusCode, 200)
    
    assert.exists(response.body.data)
    assert.property(response.body.data, 'profiles')
    assert.property(response.body.data, 'accounts')
    assert.property(response.body.data, 'cards')
    assert.property(response.body.data, 'transactions')
    
    assert.isNumber(response.body.data.profiles)
    assert.isAtLeast(response.body.data.profiles, 0)
    
    assert.isNumber(response.body.data.accounts)
    assert.isNumber(response.body.data.cards)
    assert.isNumber(response.body.data.transactions)
  })

  it('should have accounts with profile information', async () => {
    const response = await request(app).get('/za/pb/v1/accounts')
    assert.equal(response.statusCode, 200)
    
    assert.isArray(response.body.data.accounts)
    
    if (response.body.data.accounts.length > 0) {
      const account = response.body.data.accounts[0]
      
      assert.property(account, 'profileId')
      assert.property(account, 'profileName')
      assert.property(account, 'kycCompliant')
      
      assert.isString(account.profileId)
      assert.isString(account.profileName)
      assert.isBoolean(account.kycCompliant)
      
      assert.match(account.profileId, /^1000\d{10}$/)
      assert.isAbove(account.profileName.length, 0)
    }
  })

  it('should have consistent profile data across accounts', async () => {
    const response = await request(app).get('/za/pb/v1/accounts')
    assert.equal(response.statusCode, 200)
    
    const accounts = response.body.data.accounts
    
    if (accounts.length > 1) {
      const firstAccount = accounts[0]
      
      accounts.forEach((account: unknown, index: number) => {
        const acc = account as Record<string, unknown>
        assert.equal(acc.profileId, firstAccount.profileId, `Account ${index} has different profileId`)
        assert.equal(acc.profileName, firstAccount.profileName, `Account ${index} has different profileName`)
        assert.equal(acc.kycCompliant, firstAccount.kycCompliant, `Account ${index} has different kycCompliant`)
      })
    }
  })
})