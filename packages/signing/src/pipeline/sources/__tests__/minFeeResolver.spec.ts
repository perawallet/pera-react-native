/*
 Copyright 2022-2026 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
 */

import { describe, expect, it } from 'vitest'
import {
    AccountTypes,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import { createMinFeeResolver, resolveMinFeeForSender } from '../minFeeResolver'

const quantum = (overrides: Partial<WalletAccount> = {}): WalletAccount =>
    ({
        id: 'q1',
        address: 'QADDR',
        type: AccountTypes.quantum,
        keyPairId: 'kp-quantum',
        ...overrides,
    }) as WalletAccount

const algo25 = (overrides: Partial<WalletAccount> = {}): WalletAccount =>
    ({
        id: 'a1',
        address: 'AADDR',
        type: AccountTypes.algo25,
        keyPairId: 'kp-algo25',
        ...overrides,
    }) as WalletAccount

const watch = (overrides: Partial<WalletAccount> = {}): WalletAccount =>
    ({
        id: 'w1',
        address: 'WADDR',
        type: AccountTypes.watch,
        ...overrides,
    }) as WalletAccount

const baseParams = {
    suggestedMinFee: 1000n,
    configMinTxnFee: 1000n,
    pqMultiplier: 3n,
}

describe('resolveMinFeeForSender', () => {
    it('charges the multiplied fee for a quantum sender', () => {
        const fee = resolveMinFeeForSender({
            ...baseParams,
            senderAddress: 'QADDR',
            accounts: [quantum()],
        })
        expect(fee).toBe(3000n)
    })

    it('charges the base fee for an algo25 sender (regression)', () => {
        const fee = resolveMinFeeForSender({
            ...baseParams,
            senderAddress: 'AADDR',
            accounts: [algo25()],
        })
        expect(fee).toBe(1000n)
    })

    it('follows the rekey: ed25519 sender rekeyed to quantum auth pays PQ fee', () => {
        const fee = resolveMinFeeForSender({
            ...baseParams,
            senderAddress: 'AADDR',
            accounts: [algo25({ rekeyAddress: 'QADDR' }), quantum()],
        })
        expect(fee).toBe(3000n)
    })

    it('follows the rekey: quantum sender rekeyed to ed25519 auth pays base fee', () => {
        const fee = resolveMinFeeForSender({
            ...baseParams,
            senderAddress: 'QADDR',
            accounts: [quantum({ rekeyAddress: 'AADDR' }), algo25()],
        })
        expect(fee).toBe(1000n)
    })

    it('falls back to base fee for a sender not in the wallet', () => {
        const fee = resolveMinFeeForSender({
            ...baseParams,
            senderAddress: 'EXTERNAL',
            accounts: [quantum()],
        })
        expect(fee).toBe(1000n)
    })

    it('falls back to base fee for an unresolvable signer (watch account)', () => {
        const fee = resolveMinFeeForSender({
            ...baseParams,
            senderAddress: 'WADDR',
            accounts: [watch()],
        })
        expect(fee).toBe(1000n)
    })

    it('congestion guard: multiplies the max of suggested and config base, once', () => {
        const congested = resolveMinFeeForSender({
            senderAddress: 'QADDR',
            accounts: [quantum()],
            suggestedMinFee: 2000n,
            configMinTxnFee: 1000n,
            pqMultiplier: 3n,
        })
        expect(congested).toBe(6000n)
    })

    it('congestion guard: non-quantum sender pays the raised suggested fee unmultiplied', () => {
        const fee = resolveMinFeeForSender({
            senderAddress: 'AADDR',
            accounts: [algo25()],
            suggestedMinFee: 2000n,
            configMinTxnFee: 1000n,
            pqMultiplier: 3n,
        })
        expect(fee).toBe(2000n)
    })

    it('remote-config floor: config base above suggested is respected', () => {
        const fee = resolveMinFeeForSender({
            senderAddress: 'QADDR',
            accounts: [quantum()],
            suggestedMinFee: 1000n,
            configMinTxnFee: 2000n,
            pqMultiplier: 3n,
        })
        expect(fee).toBe(6000n)
    })

    it('uses the configured multiplier, not a literal', () => {
        const fee = resolveMinFeeForSender({
            ...baseParams,
            senderAddress: 'QADDR',
            accounts: [quantum()],
            pqMultiplier: 5n,
        })
        expect(fee).toBe(5000n)
    })
})

describe('createMinFeeResolver', () => {
    it('wires suggested params, config, and accounts into the pure resolver', async () => {
        const resolver = createMinFeeResolver({
            getAccounts: () => [quantum()],
            getSuggestedParams: async () => ({ minFee: 1000n }),
            getMinFeeConfig: () => ({ minTxnFee: 1000n, pqMultiplier: 3n }),
        })

        await expect(resolver('QADDR')).resolves.toBe(3000n)
        await expect(resolver('EXTERNAL')).resolves.toBe(1000n)
    })
})
