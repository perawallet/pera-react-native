import { Decimal } from 'decimal.js'

export interface Payment {
    amount: number
    networkFee: string
    unitPrice: number
    balances: number[]
    total: Decimal
    rawAmount: bigint
    feedback: string
    amountLabel: string
}
