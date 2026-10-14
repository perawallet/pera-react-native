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

import {
    createChainAdapterRegistry,
    type ChainId,
    type ChainScope,
} from '@perawallet/wallet-core-chain-contract'
import type { Nullable } from '@perawallet/wallet-core-shared'
import type { RampTokenIdentity } from './models'

export type ConfirmReceiveContext = {
    /** The destination asset, in the chain's own asset-id encoding. */
    assetId: string
    /** True when fees and minimum balance are sponsor-covered (display the fee as 0). */
    isSponsored: boolean
}

export type EnsureCanReceiveParams = {
    address: string
    scope: ChainScope
    destinationToken: RampTokenIdentity
    /**
     * Shown before anything is signed. Resolve false to cancel: `EnsureCanReceive`
     * then resolves false. When omitted, the preparation proceeds unconfirmed.
     */
    confirm?: (context: ConfirmReceiveContext) => Promise<boolean>
}

/** Resolves false when the user declined, or when there is nothing to receive into. */
export type EnsureCanReceive = (
    params: EnsureCanReceiveParams,
) => Promise<boolean>

/** How the ramp catalogue maps onto a chain; registered by the chain package. */
export interface RampChainAdapter {
    chainId: ChainId
    /**
     * The backend's ramp network ids whose tokens live on this chain. Read only
     * for a token the backend sends without a `caip19`.
     */
    rampNetworkIds: readonly string[]
    /** Catalogue ids of the tokens the ramp delivers on this chain. */
    destinationTokenIds: readonly string[]
    isNativeToken(token: RampTokenIdentity): boolean
    /**
     * The asset the token arrives as on `scope`'s network, in the chain's own
     * asset-id encoding; null when it has no asset there.
     */
    toAssetId(token: RampTokenIdentity, scope: ChainScope): Nullable<string>
    /**
     * Prepares an account to receive the destination asset before an order is
     * created. Throws `RampAttestationRequiredError` when a sponsored path needs
     * a device attestation. Omit it on a chain that needs no preparation.
     */
    useEnsureCanReceive?: () => EnsureCanReceive
}

export const rampChainAdapters =
    createChainAdapterRegistry<RampChainAdapter>('ramp')
