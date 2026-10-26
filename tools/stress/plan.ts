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

// An account exists on chain once it holds its minimum balance. Every asset it
// creates or holds raises that minimum by the same amount, and every
// transaction costs the fee.
export const MIN_BALANCE_MICROALGOS = 100_000n
export const FEE_MICROALGOS = 1_000n

/** One tier's row of e2e/stress-tiers.json, as far as the seeder needs. */
export type StressSizes = {
    accounts: number
    /** Fungible assets the holder (account 0) creates. */
    assets: number
    /** Supply-1, zero-decimal assets the holder creates. */
    nfts: number
    /** Zero-amount self-payments from the holder, which fill its history. */
    transactions: number
}

export type WalletSeedState = {
    /** HD account indices that already hold a balance. */
    funded: ReadonlySet<number>
    assetsCreated: number
    nftsCreated: number
    paymentsSent: number
    /** The holder's balance above its minimum, in microAlgos; 0n if it does not exist yet. */
    holderSpendableMicroAlgos: bigint
}

export type WalletSeedPlan = {
    /** HD account indices that don't exist on chain yet, ascending. */
    toFund: number[]
    assetsToCreate: number
    nftsToCreate: number
    paymentsToSend: number
    /** Sent to the holder on top of its minimum balance to pay for its creations and payments. */
    holderTopUpMicroAlgos: bigint
    /** What the funder must hold to pay for the whole plan, in microAlgos. */
    requiredMicroAlgos: bigint
}

const remaining = (wanted: number, existing: number): number =>
    Math.max(0, wanted - existing)

const HOLDER_INDEX = 0

export const planWalletSeed = (
    sizes: StressSizes,
    state: WalletSeedState,
): WalletSeedPlan => {
    const toFund = Array.from(
        { length: sizes.accounts },
        (_, index) => index,
    ).filter(index => !state.funded.has(index))
    const assetsToCreate = remaining(sizes.assets, state.assetsCreated)
    const nftsToCreate = remaining(sizes.nfts, state.nftsCreated)
    const paymentsToSend = remaining(sizes.transactions, state.paymentsSent)

    const holderNeed =
        BigInt(assetsToCreate + nftsToCreate) *
            (MIN_BALANCE_MICROALGOS + FEE_MICROALGOS) +
        BigInt(paymentsToSend) * FEE_MICROALGOS
    const holderTopUpMicroAlgos =
        holderNeed > state.holderSpendableMicroAlgos
            ? holderNeed - state.holderSpendableMicroAlgos
            : 0n
    // The top-up rides on the holder's own funding payment when it has one.
    const needsOwnTopUpPayment =
        holderTopUpMicroAlgos > 0n && !toFund.includes(HOLDER_INDEX)

    return {
        toFund,
        assetsToCreate,
        nftsToCreate,
        paymentsToSend,
        holderTopUpMicroAlgos,
        requiredMicroAlgos:
            BigInt(toFund.length) * (MIN_BALANCE_MICROALGOS + FEE_MICROALGOS) +
            holderTopUpMicroAlgos +
            (needsOwnTopUpPayment ? FEE_MICROALGOS : 0n),
    }
}

/**
 * A rerun against an indexer that has not caught up undercounts and sends a few
 * payments too many. This is how far over the tier a wallet can sit and still
 * count as seeded for it.
 */
export const PAYMENT_OVERSHOOT_TOLERANCE = 100

/**
 * Why a wallet already holds more than `sizes`, if it does. One phrase belongs to
 * one tier: the app imports every funded account, and account 0 holds everything
 * ever made for it, so a smaller tier run on a bigger tier's phrase would measure
 * the bigger tier's data under the smaller tier's name.
 */
export const seededBeyondTier = (
    sizes: StressSizes,
    state: WalletSeedState,
    nextAccountFunded: boolean,
): string[] => {
    const reasons: string[] = []
    if (state.assetsCreated > sizes.assets) {
        reasons.push(
            `it holds ${state.assetsCreated} assets, the tier wants ${sizes.assets}`,
        )
    }
    if (state.nftsCreated > sizes.nfts) {
        reasons.push(
            `it holds ${state.nftsCreated} NFTs, the tier wants ${sizes.nfts}`,
        )
    }
    if (state.paymentsSent > sizes.transactions + PAYMENT_OVERSHOOT_TOLERANCE) {
        reasons.push(
            `it has sent ${state.paymentsSent} payments, the tier wants ${sizes.transactions}`,
        )
    }
    if (nextAccountFunded) {
        reasons.push(
            `account ${sizes.accounts} is funded too, and the import would find it`,
        )
    }
    return reasons
}
