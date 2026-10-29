import type { Maybe, Nullable, Optional } from '@perawallet/wallet-core-shared'
import { Decimal } from 'decimal.js'

export interface Quote {
    fee: Nullable<number>
    balance?: Optional<string>
    price: Maybe<number>
    minAmount: Optional<Nullable<string>>
    maxAmount: Nullable<number | Decimal> | undefined
    total: Nullable<Decimal>
    networkFee: Optional<Decimal>
    label: Nullable<string>
}

export function quote(amount: Nullable<number>, fee: Maybe<Decimal>): void {
    let pendingFee: Optional<string> = undefined
    const price: Nullable<Decimal> = null
    void [amount, fee, pendingFee, price]
}
