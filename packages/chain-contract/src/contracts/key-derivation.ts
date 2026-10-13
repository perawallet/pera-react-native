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

import type { DeriveOpts, SigningScheme } from '../models/domain'
import type { ChainId } from '../models/identity'
import { createChainAdapterRegistry } from '../registry'

/** The KMS id of a seed, never key material. */
export type SeedRef = string

export interface KeyDerivationRequest {
    scheme: SigningScheme
    path: string
    /** Stored accounts reference this id, so a chain must never change its format. */
    id: string
    /** Backend options the chain owns; the key store passes them through unread. */
    params?: Readonly<Record<string, unknown>>
}

export interface KeyImportRequest {
    scheme: SigningScheme
    /**
     * Stored accounts reference this id, so a chain must never change its format.
     * It derives from the key bytes, so a re-import resolves to the entry it made before.
     */
    id: string
    /** Attaches the imported key under an existing seed. */
    parentKeyId?: string
}

export interface DerivedKey {
    keyPairId: string
    publicKey: Uint8Array
}

/**
 * The KMS as a chain sees it: every key byte stays behind this port, and
 * the chain decides paths, ids and address encoding. An unsupported scheme throws.
 */
export interface ChainKeyStore {
    deriveFromSeed(
        seedRef: SeedRef,
        request: KeyDerivationRequest,
        domain: string,
    ): Promise<DerivedKey>
    importRawKey(
        bytes: Uint8Array,
        request: KeyImportRequest,
        domain: string,
    ): Promise<DerivedKey>
    /** Signs `payload` as given: no prefix or hashing is added (see `SigningRequest.payload`). */
    sign(
        keyPairId: string,
        payload: Uint8Array,
        domain: string,
    ): Promise<Uint8Array>
}

export type DerivedAccount = DerivedKey & { address: string }

export interface ImportedAccount {
    keyPairId: string
    address: string
}

/** Resolves true when the address has on-chain activity. */
export type AddressProbe = (address: string) => Promise<boolean>

export interface DiscoveryCandidate {
    account: number
    keyIndex: number
    address: string
    keyPairId: string
}

export interface KeyDerivation {
    readonly chainId: ChainId
    deriveAccount(
        kms: ChainKeyStore,
        seedRef: SeedRef,
        account: number,
        keyIndex: number,
        opts: DeriveOpts,
    ): Promise<DerivedAccount>
    importRawKey(
        kms: ChainKeyStore,
        bytes: Uint8Array,
        opts: DeriveOpts,
    ): Promise<ImportedAccount>
    /** `opts` as for `deriveAccount`: the address a probe sees depends on the network. */
    discover(
        kms: ChainKeyStore,
        seedRef: SeedRef,
        probe: AddressProbe,
        opts: DeriveOpts,
    ): Promise<DiscoveryCandidate[]>
}

export const keyDerivations =
    createChainAdapterRegistry<KeyDerivation>('keyDerivation')
