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
    scopeForLegacyNetwork,
    type ChainId,
} from '@perawallet/wallet-core-chain-contract'
import type { ALGO_ASSET_NAME, Network } from '@perawallet/wallet-core-shared'
import type { RampToken } from './models'

export type ConfirmReceiveContext = {
    assetId: bigint
    /** True when fees and minimum balance are sponsor-covered (display the fee as 0). */
    isSponsored: boolean
}

export type EnsureCanReceiveParams = {
    address: string
    /** 'ALGO' is the native asset and needs no preparation; otherwise the on-chain asset id. */
    destinationAssetId: bigint | typeof ALGO_ASSET_NAME
    /**
     * Shown before anything is signed. Resolve false to cancel: `EnsureCanReceive`
     * then resolves false. When omitted, the preparation proceeds unconfirmed.
     */
    confirmOptIn?: (context: ConfirmReceiveContext) => Promise<boolean>
}

/** Resolves false when the user declined the confirmation. */
export type EnsureCanReceive = (
    params: EnsureCanReceiveParams,
) => Promise<boolean>

/** How the ramp catalogue maps onto a chain; registered by the chain package. */
export interface RampChainAdapter {
    chainId: ChainId
    /** Catalogue ids of the tokens the ramp delivers on this chain. */
    destinationTokenIds: readonly string[]
    isNativeToken(token: Pick<RampToken, 'id' | 'symbol'>): boolean
    /** The on-chain asset id the token arrives as, as a decimal string. */
    toAssetId(token: Pick<RampToken, 'id' | 'symbol'>): string
    /**
     * Prepares an account to receive the destination asset before an order is
     * created. Throws `RampAttestationRequiredError` when a sponsored path needs
     * a device attestation. Omit it on a chain that needs no preparation.
     */
    useEnsureCanReceive?: () => EnsureCanReceive
}

export const rampChainAdapters =
    createChainAdapterRegistry<RampChainAdapter>('ramp')

export const rampAdapterFor = (network: Network): RampChainAdapter =>
    rampChainAdapters.get(scopeForLegacyNetwork(network).chainId)
