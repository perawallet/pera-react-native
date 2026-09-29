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
import {
    addressCodecs,
    createChainAdapterRegistry,
    keyDerivations,
    scopeForLegacyNetwork,
    type AddressCodec,
    type ChainId,
    type ChainScope,
    type DeriveOpts,
} from '@perawallet/wallet-core-chain-contract'
import type { AccountInformation } from '@perawallet/wallet-core-blockchain'
import {
    kmsCore,
    type QuantumChainDerivation,
} from '@perawallet/wallet-core-kms'
import type { Network, Nullable } from '@perawallet/wallet-core-shared'
import {
    HdDerivationTypeUnsupportedError,
    QuantumAccountsUnsupportedError,
    RekeyUnsupportedError,
} from './errors'
import type { DerivationType, HDWalletDetails } from './models'

export type AccountHoldingSnapshot = {
    assetId: string
    /** Base units. */
    amount: Decimal
    isFrozen: boolean
}

/** One read of an account's balance, holdings and signer, as the syncer persists it. */
export type AccountStateSnapshot = {
    /** Display units of the chain's native asset. */
    nativeBalance: Decimal
    /** Display units of the chain's native asset; zero on a chain with no reserve. */
    minBalance: Decimal
    // Algorand's resource counts and participation status. A chain without
    // the concept omits them and the balance row keeps its column defaults.
    totalAssetsOptedIn?: number
    totalCreatedAssets?: number
    totalAppsOptedIn?: number
    status?: string
    /** The account's signer when it isn't the account's own key. */
    authAddress: Nullable<string>
    /** Includes the native asset, so reads sort and page it like any holding. */
    holdings: AccountHoldingSnapshot[]
    /**
     * The minimum round across every source read, so the sync checkpoint only
     * advances past rounds actually observed. Null when the source omits it.
     */
    observedRound: Nullable<number>
}

export type AccountStateReadHint = {
    /** Resources the account held at its last sync; 0 when never synced. */
    priorResourceCount: number
}

export type GetPublicKey = (params: {
    account: number
    keyIndex: number
    derivationType: DerivationType
}) => Promise<Uint8Array>

/** The chain-specific half of account state, discovery, creation and rekey; registered by the chain package. */
export interface AccountsChainAdapter {
    readonly chainId: ChainId
    /** The derivation type new HD accounts on this chain are created with. */
    readonly hdDerivationType: DerivationType
    fetchAccountState(
        address: string,
        scope: ChainScope,
        hint: AccountStateReadHint,
    ): Promise<AccountStateSnapshot>
    fetchAccountInformation(
        address: string,
        scope: ChainScope,
    ): Promise<AccountInformation>
    /** Opt-in round per held asset, keyed by asset id. Absent on a chain without opt-in. */
    fetchAssetOptInRounds?(
        address: string,
        scope: ChainScope,
    ): Promise<Map<string, number>>
    /** Any on-chain footprint counts, not only a funded balance. */
    accountExists(address: string, scope: ChainScope): Promise<boolean>
    /**
     * Batch activity probe for HD discovery. Never rejects: a failed probe
     * reads as inactive so the gap limit still ends the scan.
     */
    checkActivity(
        addresses: string[],
        scope: ChainScope,
    ): Promise<Map<string, boolean>>
    /** Public keys from an in-memory root key, for discovery before the seed is persisted. */
    createPublicKeyGetter(rootKey: Uint8Array): GetPublicKey
    /**
     * Keystore id of the HD child at these coordinates, computed without
     * deriving. Stored accounts reference this id, so its format never changes,
     * and it must equal the `keyPairId` the chain's `KeyDerivation` returns.
     */
    hdKeyPairId(
        seedKeyId: string,
        details: Pick<
            HDWalletDetails,
            'account' | 'keyIndex' | 'derivationType'
        >,
    ): string
    /** Throws `InvalidBip44PathError` when `hdPath` is malformed or names other coordinates. */
    assertHdPathMatches(hdPath: string, details: HDWalletDetails): void
    /** Absent on a chain with no post-quantum accounts. */
    readonly quantum?: QuantumChainDerivation
    /** Accounts whose signer is `authAddress`. Absent on a chain without rekey. */
    fetchRekeyedAddresses?(
        authAddress: string,
        scope: ChainScope,
    ): Promise<string[]>
}

export const accountsChainAdapters =
    createChainAdapterRegistry<AccountsChainAdapter>('accounts')

// Every legacy `Network` belongs to one chain; chain-contract owns that mapping.
export const accountsAdapterFor = (network: Network): AccountsChainAdapter =>
    accountsChainAdapters.get(scopeForLegacyNetwork(network).chainId)

export const addressCodecFor = (network: Network): AddressCodec =>
    addressCodecs.get(scopeForLegacyNetwork(network).chainId)

export const ed25519DeriveOpts = (network: Network): DeriveOpts => ({
    scheme: 'ed25519',
    networkId: scopeForLegacyNetwork(network).networkId,
})

export type HdAccountCoordinates = {
    account: number
    keyIndex: number
    /** Defaults to the chain's `hdDerivationType`; a backup payload's is unvalidated, hence `number`. */
    derivationType?: number
}

/**
 * Derives the HD child through the chain's registered `KeyDerivation`.
 * `KeyDerivation.deriveAccount` only derives the chain's own `hdDerivationType`, so
 * any other requested type throws {@link HdDerivationTypeUnsupportedError} rather
 * than yielding a key that doesn't match the type a record names.
 */
export const deriveHdAccount = async (
    network: Network,
    seedKeyId: string,
    { account, keyIndex, derivationType }: HdAccountCoordinates,
) => {
    const adapter = accountsAdapterFor(network)
    if (
        derivationType !== undefined &&
        derivationType !== adapter.hdDerivationType
    ) {
        throw new HdDerivationTypeUnsupportedError(
            derivationType,
            adapter.chainId,
        )
    }
    return keyDerivations
        .get(adapter.chainId)
        .deriveAccount(
            kmsCore,
            seedKeyId,
            account,
            keyIndex,
            ed25519DeriveOpts(network),
        )
}

/** Throws {@link RekeyUnsupportedError} on a chain without rekey. */
export const requireRekey = (
    adapter: AccountsChainAdapter,
): NonNullable<AccountsChainAdapter['fetchRekeyedAddresses']> => {
    if (!adapter.fetchRekeyedAddresses) {
        throw new RekeyUnsupportedError(adapter.chainId)
    }
    return adapter.fetchRekeyedAddresses.bind(adapter)
}

/** Throws {@link QuantumAccountsUnsupportedError} on a chain without post-quantum accounts. */
export const requireQuantum = (
    adapter: AccountsChainAdapter,
): QuantumChainDerivation => {
    if (!adapter.quantum) {
        throw new QuantumAccountsUnsupportedError(adapter.chainId)
    }
    return adapter.quantum
}

/** Rejects with {@link RekeyUnsupportedError} on a chain without rekey. */
export const fetchRekeyedAddresses = async (
    authAddress: string,
    network: Network,
): Promise<string[]> =>
    requireRekey(accountsAdapterFor(network))(
        authAddress,
        scopeForLegacyNetwork(network),
    )

export const quantumDerivationFor = (
    network: Network,
): QuantumChainDerivation => requireQuantum(accountsAdapterFor(network))

/** Empty on a chain without asset opt-in. */
export const fetchAssetOptInRounds = async (
    address: string,
    network: Network,
): Promise<Map<string, number>> => {
    const adapter = accountsAdapterFor(network)
    return adapter.fetchAssetOptInRounds
        ? adapter.fetchAssetOptInRounds(address, scopeForLegacyNetwork(network))
        : new Map()
}

export const fetchAccountInformation = (
    address: string,
    network: Network,
): Promise<AccountInformation> =>
    accountsAdapterFor(network).fetchAccountInformation(
        address,
        scopeForLegacyNetwork(network),
    )
