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
import type { Nullable } from '@perawallet/wallet-core-shared'
import type { PeraAssetVerificationTier } from '@perawallet/wallet-core-assets'
import type { HoldingRestriction } from './balances'

export type LedgerAccountPreviewAsset = {
    assetId: string
    name: string
    unitName: string
    /** Asset decimals (display precision) */
    decimals: number
    /**
     * False when the asset's metadata (and so its decimals) is unknown —
     * `amount` then still holds raw base units and must not be rendered as a
     * balance; `fiatValue` is zero regardless of any known price.
     */
    hasKnownDecimals: boolean
    /** Holding amount in display units (base units when decimals unknown) */
    amount: Decimal
    /**
     * Holding value in the user's preferred currency; `null` when the rate is
     * unresolved (offline, not yet synced) — not 0.
     */
    fiatValue: Nullable<Decimal>
    /** Asset USD price (0 when unknown) */
    usdPrice: Decimal
    verificationTier: PeraAssetVerificationTier
    logo?: string
    isNative: boolean
    /** `null` when the chain places no restriction on the holding. */
    restriction: Nullable<HoldingRestriction>
}

export type LedgerAccountDelegation =
    | { kind: 'delegatedTo'; authorityAddress: string }
    | { kind: 'canSignFor'; addresses: string[] }
    | { kind: 'none' }

export type LedgerAccountPreview = {
    address: string
    /** Native asset balance in display units */
    nativeBalance: Decimal
    /**
     * Total account value in the user's preferred currency; `null` when the
     * rate is unresolved (offline, not yet synced) — not 0.
     */
    totalFiatValue: Nullable<Decimal>
    /** The native asset first, then the account's holdings in the chain's order */
    assets: LedgerAccountPreviewAsset[]
    delegation: LedgerAccountDelegation
}

export type UseLedgerAccountPreviewResult = {
    preview?: LedgerAccountPreview
    isLoading: boolean
    isError: boolean
    refetch: () => void
}
