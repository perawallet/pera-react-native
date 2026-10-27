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
    FEE_MICROALGOS,
    MIN_BALANCE_MICROALGOS,
    PAYMENT_OVERSHOOT_TOLERANCE,
    planWalletSeed,
    seededBeyondTier,
    type StressSizes,
    type WalletSeedState,
} from '../plan'

const range = (from: number, to: number): number[] =>
    Array.from({ length: to - from }, (_, i) => from + i)

const NOTHING_YET: WalletSeedState = {
    funded: new Set(),
    assetsCreated: 0,
    nftsCreated: 0,
    paymentsSent: 0,
    holderSpendableMicroAlgos: 0n,
}

const ACCOUNTS_ONLY: StressSizes = {
    accounts: 100,
    assets: 0,
    nfts: 0,
    transactions: 0,
}

const L: StressSizes = {
    accounts: 100,
    assets: 1000,
    nfts: 500,
    transactions: 10_000,
}

describe('planWalletSeed accounts', () => {
    it('funds every account of a fresh tier and prices it exactly', () => {
        const plan = planWalletSeed(ACCOUNTS_ONLY, NOTHING_YET)

        expect(plan.toFund).toEqual(range(0, 100))
        expect(plan.requiredMicroAlgos).toBe(
            100n * (MIN_BALANCE_MICROALGOS + FEE_MICROALGOS),
        )
        expect(plan.requiredMicroAlgos).toBe(10_100_000n)
    })

    it('plans only the accounts still missing after an interrupted run', () => {
        const plan = planWalletSeed(ACCOUNTS_ONLY, {
            ...NOTHING_YET,
            funded: new Set(range(0, 50)),
        })

        expect(plan.toFund).toEqual(range(50, 100))
        expect(plan.requiredMicroAlgos).toBe(50n * 101_000n)
    })

    it('has nothing to do once every account exists', () => {
        const plan = planWalletSeed(ACCOUNTS_ONLY, {
            ...NOTHING_YET,
            funded: new Set(range(0, 100)),
        })

        expect(plan.toFund).toEqual([])
        expect(plan.requiredMicroAlgos).toBe(0n)
    })

    it('never plans negative work for a wallet already seeded for a bigger tier', () => {
        const plan = planWalletSeed(ACCOUNTS_ONLY, {
            ...NOTHING_YET,
            funded: new Set(range(0, 200)),
        })

        expect(plan.toFund).toEqual([])
        expect(plan.requiredMicroAlgos).toBe(0n)
    })

    it('fills a gap in the middle without touching the accounts either side', () => {
        const plan = planWalletSeed(
            { ...ACCOUNTS_ONLY, accounts: 5 },
            { ...NOTHING_YET, funded: new Set([0, 1, 3, 4]) },
        )

        expect(plan.toFund).toEqual([2])
    })
})

describe('planWalletSeed holdings and history', () => {
    it('prices a fresh tier: every account, 0.1 ALGO minimum balance per asset, and fees', () => {
        const plan = planWalletSeed(L, NOTHING_YET)

        expect(plan.assetsToCreate).toBe(1000)
        expect(plan.nftsToCreate).toBe(500)
        expect(plan.paymentsToSend).toBe(10_000)
        // 1,500 creations at minimum balance plus fee, and 10,000 payments at fee.
        expect(plan.holderTopUpMicroAlgos).toBe(
            1_500n * 101_000n + 10_000n * 1_000n,
        )
        // Account 0 is funded in toFund, so there is no separate top-up payment to pay a fee on.
        expect(plan.requiredMicroAlgos).toBe(
            100n * 101_000n + plan.holderTopUpMicroAlgos,
        )
        expect(plan.requiredMicroAlgos).toBe(171_600_000n)
    })

    it("plans only what is missing and nets the holder's spare balance off the top-up", () => {
        const plan = planWalletSeed(L, {
            funded: new Set(range(0, 100)),
            assetsCreated: 400,
            nftsCreated: 0,
            paymentsSent: 5000,
            holderSpendableMicroAlgos: 50_000_000n,
        })

        expect(plan.toFund).toEqual([])
        expect(plan.assetsToCreate).toBe(600)
        expect(plan.nftsToCreate).toBe(500)
        expect(plan.paymentsToSend).toBe(5000)
        // 1,100 creations and 5,000 payments cost 116.1 ALGO; the holder has 50 spare.
        expect(plan.holderTopUpMicroAlgos).toBe(66_100_000n)
        // Account 0 exists, so the top-up is a payment of its own with its own fee.
        expect(plan.requiredMicroAlgos).toBe(66_100_000n + FEE_MICROALGOS)
    })

    it('asks the funder for nothing when the holder can already pay for the rest', () => {
        const plan = planWalletSeed(L, {
            funded: new Set(range(0, 100)),
            assetsCreated: 900,
            nftsCreated: 500,
            paymentsSent: 10_000,
            holderSpendableMicroAlgos: 100_000_000n,
        })

        expect(plan.assetsToCreate).toBe(100)
        expect(plan.holderTopUpMicroAlgos).toBe(0n)
        expect(plan.requiredMicroAlgos).toBe(0n)
    })

    it('never plans negative work for a wallet seeded for a bigger tier', () => {
        const plan = planWalletSeed(L, {
            funded: new Set(range(0, 200)),
            assetsCreated: 2000,
            nftsCreated: 1000,
            paymentsSent: 20_000,
            holderSpendableMicroAlgos: 0n,
        })

        expect(plan.assetsToCreate).toBe(0)
        expect(plan.nftsToCreate).toBe(0)
        expect(plan.paymentsToSend).toBe(0)
        expect(plan.requiredMicroAlgos).toBe(0n)
    })
})

describe('seededBeyondTier', () => {
    const SEEDED_FOR_L: WalletSeedState = {
        funded: new Set(range(0, 100)),
        assetsCreated: 1000,
        nftsCreated: 500,
        paymentsSent: 10_000,
        holderSpendableMicroAlgos: 0n,
    }
    const S: StressSizes = {
        accounts: 10,
        assets: 100,
        nfts: 50,
        transactions: 1000,
    }

    it('accepts a wallet seeded exactly for the tier, and one still being filled', () => {
        expect(seededBeyondTier(L, SEEDED_FOR_L, false)).toEqual([])
        expect(seededBeyondTier(L, NOTHING_YET, false)).toEqual([])
    })

    it('names each dimension a smaller tier finds already seeded past its size', () => {
        const reasons = seededBeyondTier(S, SEEDED_FOR_L, true)

        expect(reasons).toHaveLength(4)
        expect(reasons.join('\n')).toMatch(/1000 assets/)
        expect(reasons.join('\n')).toMatch(/500 NFTs/)
        expect(reasons.join('\n')).toMatch(/10000 payments/)
        expect(reasons.join('\n')).toMatch(/account 10/)
    })

    it('notices an extra funded account even when nothing else is over', () => {
        expect(seededBeyondTier(L, SEEDED_FOR_L, true)).toHaveLength(1)
    })

    it('forgives a few payments over, which a rerun against a lagging indexer can send', () => {
        const slightlyOver = {
            ...SEEDED_FOR_L,
            paymentsSent: 10_000 + PAYMENT_OVERSHOOT_TOLERANCE,
        }
        const wayOver = {
            ...SEEDED_FOR_L,
            paymentsSent: 10_000 + PAYMENT_OVERSHOOT_TOLERANCE + 1,
        }

        expect(seededBeyondTier(L, slightlyOver, false)).toEqual([])
        expect(seededBeyondTier(L, wayOver, false)).toHaveLength(1)
    })
})
