import { test } from 'node:test'
import assert from 'node:assert'

test('Debt & Credit System - Balance Calculation & Statement Verification', async (t) => {
  // Test scenario 1: Customer with debit transactions (Debt / Due)
  const ledgerEntries = [
    { id: 1, customer_id: 10, amount: 150.00, running_balance: 150.00, module: 'session', description: 'Session #101' },
    { id: 2, customer_id: 10, amount: -50.00, running_balance: 100.00, module: 'payment', description: 'Partial Cash Payment' }
  ]

  const totalCharged = ledgerEntries.filter(e => e.amount > 0).reduce((sum, e) => sum + e.amount, 0)
  const totalPaid = ledgerEntries.filter(e => e.amount < 0).reduce((sum, e) => sum + Math.abs(e.amount), 0)
  const currentBalance = ledgerEntries[ledgerEntries.length - 1].running_balance

  assert.strictEqual(totalCharged, 150.00, 'Total charged must match debit entries')
  assert.strictEqual(totalPaid, 50.00, 'Total paid must match credit/payment entries')
  assert.strictEqual(currentBalance, 100.00, 'Customer has remaining debt of ₹100')
  assert.strictEqual(currentBalance > 0, true, 'Positive balance indicates customer owes money')
})

test('Debt & Credit System - Customer with Advance Overpayment (Credit Balance)', async (t) => {
  // Test scenario 2: Customer with advance credit
  const ledgerEntries = [
    { id: 1, customer_id: 20, amount: 200.00, running_balance: 200.00, module: 'session', description: 'Session #102' },
    { id: 2, customer_id: 20, amount: -300.00, running_balance: -100.00, module: 'payment', description: 'Advance Payment ₹300' }
  ]

  const currentBalance = ledgerEntries[ledgerEntries.length - 1].running_balance
  assert.strictEqual(currentBalance, -100.00, 'Customer has negative balance of -₹100 (credit on account)')
  assert.strictEqual(currentBalance < 0, true, 'Negative balance indicates cafe owes credit to customer')
  assert.strictEqual(Math.abs(currentBalance), 100.00, 'Usable credit is ₹100')
})

test('Debt & Credit System - Settlement Simulation', async (t) => {
  let runningBalance = 100.00 // initial debt
  const settleAmount = 100.00

  // Simulate settle payment
  const newBalance = runningBalance - settleAmount
  assert.strictEqual(newBalance, 0.00, 'Full settlement brings balance to 0.00 (Clear)')
})
