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

import type { AssetRef, SigningScheme } from './domain'
import type { ChainFamily, ChainId, ChainNetwork, NetworkId } from './identity'

export interface NativeAssetInfo {
    ref: AssetRef
    symbol: string
    name: string
    /** Base units per display unit, as a power of ten. */
    decimals: number
}

export type DerivationPathBuilder = (
    account: number,
    keyIndex: number,
) => string

export interface ChainSigning {
    schemes: readonly SigningScheme[]
    /** Partial: a scheme whose keys are not path-derived (e.g. Algorand's Falcon) has none. */
    derivationPaths: Partial<Record<SigningScheme, DerivationPathBuilder>>
}

export interface ChainProtocolFacts {
    feeModel: 'flat' | 'gas' | 'rate'
    hasAccountNonce: boolean
    requiresAssetOptIn: boolean
    hasMinimumBalance: boolean
    supportsAtomicGroups: boolean
    supportsReplacement: boolean
    supportsNativeMultisig: boolean
    supportsRekey: boolean
    multipleAddressesPerAccount: boolean
}

/**
 * Builders rather than base URLs because the base comes from the chain's own
 * config. Each returns undefined for a network with no explorer, such as a custom one.
 */
export interface ExplorerUrlBuilders {
    accountUrl(networkId: NetworkId, address: string): string | undefined
    transactionUrl(networkId: NetworkId, txId: string): string | undefined
    assetUrl(networkId: NetworkId, assetId: string): string | undefined
}

export type ChainFinality =
    | { kind: 'instant' }
    | { kind: 'confirmations'; recommended: number }

/**
 * What is intrinsic to a chain and never switched off. Switchable features
 * are `ChainCapability`; endpoints come from config, not from here.
 */
export interface ChainDescriptor {
    id: ChainId
    family: ChainFamily
    displayName: string
    networks: readonly ChainNetwork[]
    nativeAsset: NativeAssetInfo
    signing: ChainSigning
    protocol: ChainProtocolFacts
    explorer: ExplorerUrlBuilders
    finality: ChainFinality
}
