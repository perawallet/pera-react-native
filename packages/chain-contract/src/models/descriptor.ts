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

/** How a standalone account's secret is shown and backed up on a chain. */
export type StandaloneSecret = 'mnemonic' | 'privateKey'

export interface ChainSigning {
    schemes: readonly SigningScheme[]
    /** Partial: a scheme whose keys are not path-derived (e.g. Algorand's Falcon) has none. */
    derivationPaths: Partial<Record<SigningScheme, DerivationPathBuilder>>
    /** Schemes whose keys a user can import from raw private-key bytes; a subset of `schemes`. */
    rawKeySchemes: readonly SigningScheme[]
    /** Absent on a chain without standalone accounts. */
    standaloneSecret?: StandaloneSecret
}

/**
 * How a chain prices a transaction: `'flat'` charges one fixed amount, `'gas'`
 * prices per unit of execution with tip presets, `'rate'` prices per unit of
 * transaction size.
 */
export type FeeModel = 'flat' | 'gas' | 'rate'

export interface ChainProtocolFacts {
    feeModel: FeeModel
    hasAccountNonce: boolean
    supportsReplacement: boolean
    supportsNativeMultisig: boolean
    supportsRekey: boolean
    /** An account can grant a contract an allowance over its tokens. */
    hasTokenApproval: boolean
    /** An account must opt in to an asset before it can receive it. */
    requiresAssetOptIn: boolean
    /**
     * A send resolves only once the transaction is confirmed. False means it
     * resolves on broadcast and can still be dropped or revert.
     */
    confirmsOnSubmit: boolean
    /** UTF-8 bytes a transaction's free-text note may hold; absent when the chain has no note field. */
    maxNoteBytes?: number
}

/**
 * Builders rather than base URLs because the base comes from the chain's own
 * config. Each returns undefined for a network with no explorer, such as a custom one.
 */
export interface ExplorerUrlBuilders {
    accountUrl(networkId: NetworkId, address: string): string | undefined
    transactionUrl(networkId: NetworkId, txId: string): string | undefined
    assetUrl(networkId: NetworkId, assetId: string): string | undefined
    collectibleUrl(networkId: NetworkId, assetId: string): string | undefined
}

export interface ChainExplorer extends ExplorerUrlBuilders {
    /** A brand name ("Etherscan"), shown untranslated. */
    name: string
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
    explorer: ChainExplorer
    finality: ChainFinality
    /** Schemes, without the `:`, that the chain's payment and deep links use. */
    uriSchemes: readonly string[]
    /**
     * A new account is enabled on this chain without being asked: on create,
     * and as its family's fallback when an import or watch finds no activity.
     */
    enabledByDefault: boolean
}
