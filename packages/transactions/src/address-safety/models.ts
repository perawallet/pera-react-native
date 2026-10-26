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

import type { Decimal } from 'decimal.js'
import type {
    ChainId,
    ChainScope,
} from '@perawallet/wallet-core-chain-contract'
import type { Optional } from '@perawallet/wallet-core-shared'

/** `watched-account` is in the wallet but nothing held locally can sign for it. */
export type KnownAddressSource =
    | 'own-account'
    | 'watched-account'
    | 'contact'
    | 'history'

export interface KnownAddress {
    address: string
    source: KnownAddressSource
    /** Account or contact name; absent for history. */
    name?: string
    /**
     * A history counterparty the account never paid. Paying the account is
     * all it takes to get here, so a poisoner can.
     */
    isInboundOnly?: boolean
}

export interface TrustedCounterparty {
    address: string
    /** The account signed a transfer to it, rather than only receiving from it. */
    hasBeenPaid: boolean
}

export type RecipientAssessment =
    | { kind: 'known'; source: KnownAddressSource }
    | { kind: 'look-alike'; knownAddress: KnownAddress }
    | { kind: 'first-send' }

export type AssessRecipientInput = {
    recipient: string
    chainId: ChainId
    knownAddresses: readonly KnownAddress[]
}

export type TransferValuation = {
    /** Base units. */
    value: Decimal
    decimals: Optional<number>
    usdPrice: Optional<Decimal>
    isNative: boolean
    isVerified: boolean
    isSuspicious: boolean
    isSignedByAccount: boolean
}

export type FetchTrustedCounterpartiesParams = {
    accountAddress: string
    scope: ChainScope
    signal?: AbortSignal
}
