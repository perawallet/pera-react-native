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

import { Decimal } from 'decimal.js'
import type { WalletAccount } from '@perawallet/wallet-core-accounts'
import {
    createChainAdapterRegistry,
    type AssetRef,
    type BuildContext,
    type ChainId,
    type ChainScope,
    type FeeEstimate,
    type LocalizedText,
    type TransactionIntent,
    type TransactionSummary,
    type UnsignedTransaction,
} from '@perawallet/wallet-core-chain-contract'
import type { Optional } from '@perawallet/wallet-core-shared'

/** Copy a chain hands the app to render as is; every `params` value is display-ready. */
export type ChainNotice = {
    title: LocalizedText
    /** One paragraph each. */
    body: readonly LocalizedText[]
}

export type ReserveNotice = ChainNotice & {
    /** No send can release the reserve, so MAX offers `max` rather than the whole balance. */
    isFirm: boolean
}

export type EmptyAccountOffer = {
    /** Base units of the native asset; sending it empties and closes the account. */
    amount: Decimal
    notice: ChainNotice
}

/** A broadcast the synced balance may not reflect yet, as the submission ledger records it. */
export type InFlightSpend = {
    /** Absent on chains with no account sequence number. */
    nonce?: number
    /** Base units of each asset the transaction moves out of the account. */
    outflows: readonly { assetRef: AssetRef; value: Decimal }[]
    /** Base units of the native asset: the most it can be charged; absent when unknown. */
    maxFee?: Decimal
}

export type SpendableBalanceInput = {
    account: WalletAccount
    asset: AssetRef
    scope: ChainScope
    /** Base units of the native asset. */
    fee: Decimal
    /**
     * The account's attempts in `scope` the synced balance may not reflect:
     * open ones, and confirmed ones a chain with a nonce drops once the synced
     * nonce passes them. A chain whose attempts settle before its synced
     * balance can lag behind them ignores it.
     */
    inFlight?: readonly InFlightSpend[]
}

export type SpendableBalance = {
    /** Base units of the asset, as last synced. */
    balance: Decimal
    /**
     * Base units of the asset a send can move while the account stays open;
     * the fee is already off for the native asset. Never negative.
     */
    max: Decimal
    /** Base units of the asset held back from `max`, besides the fee; zero when none is. */
    reserved: Decimal
    /** Explains the reserve when more than `max` is asked for, offering `max` instead. */
    reserveNotice?: ReserveNotice
    /** Absent on a chain with no close-out. */
    emptyAccount?: EmptyAccountOffer
}

export type RecipientWarningInput = {
    recipient: string
    asset: AssetRef
    /** Base units of the asset. */
    amount: Decimal
    scope: ChainScope
}

export type TransactionReplacementKind = 'speed-up' | 'cancel'

/** A pending transaction to re-price at its own sequence number. */
export type TransactionReplacementRequest = {
    kind: TransactionReplacementKind
    /** The pending transaction as the submission ledger stores it, in its chain's own encoding. */
    rawTransaction: string
    /** The pending transaction's history summary, which a speed-up keeps; absent when the ledger holds none. */
    summary?: TransactionSummary
}

export type AddressPoisoningRules = {
    /**
     * Leading plus trailing characters a different known address must share
     * to read as a look-alike. Addresses are compared as raw strings, so a
     * chain whose addresses share a prefix (EVM's `0x`) or vary in case must
     * normalise them before it opts in.
     */
    lookalikeMatchedChars: number
    /** Base units of the native asset; an incoming native transfer at or below it reads as dust. */
    dustCeiling: Decimal
}

/** Turns what the user asked for into a chain's transactions, and prices it. */
export interface TransferChainAdapter {
    chainId: ChainId
    /**
     * Ready to sign as returned: any grouping is already applied, so callers
     * never reorder or regroup the result.
     */
    build(
        intent: TransactionIntent,
        context: BuildContext,
    ): Promise<UnsignedTransaction[]>
    /** In the chain's native asset, in base units. */
    getFeeEstimate(
        intent: TransactionIntent,
        context: BuildContext,
    ): Promise<FeeEstimate>
    /** Reads synced state only, so it answers offline. */
    spendableBalance(input: SpendableBalanceInput): Promise<SpendableBalance>
    /** Why the send would leave the recipient unable to hold what it receives; undefined when it can. */
    recipientWarning?(
        input: RecipientWarningInput,
    ): Promise<Optional<ChainNotice>>
    /** Base units of the native asset an account must lock to hold one more asset. */
    holdingReserve?(scope: ChainScope): Optional<Decimal>
    /**
     * Re-prices a pending transaction at its own sequence number, so it never
     * takes a new one. Only on a chain whose descriptor sets
     * `protocol.supportsReplacement`.
     */
    buildReplacement?(
        request: TransactionReplacementRequest,
        context: BuildContext,
    ): Promise<UnsignedTransaction[]>
    /**
     * Read on every screening, so a chain can retune it remotely. Absent on a
     * chain that doesn't screen recipients for address poisoning.
     */
    addressPoisoning?(): AddressPoisoningRules
}

export const transferChainAdapters =
    createChainAdapterRegistry<TransferChainAdapter>('transfer')

/** Base units of the native asset; zero on a chain with no per-holding reserve. */
export const holdingReserveOf = (scope: ChainScope): Decimal =>
    transferChainAdapters.get(scope.chainId).holdingReserve?.(scope) ??
    new Decimal(0)
