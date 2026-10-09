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

import type {
    ChainDescriptor,
    ChainId,
    SigningScheme,
} from '@perawallet/wallet-core-chain-contract'
import {
    resolveSeedKeyFrom,
    seedSchemeOf,
    type SeedScheme,
} from '@perawallet/wallet-core-kms'
import {
    getKeystoreStore,
    getProvider,
} from '@perawallet/wallet-extension-provider'
import { accountsChainAdapters } from '../chain-adapter'
import { localKeyKindOf } from '../import-formats'
import type { WalletAccount } from '../models'
import { signingKeyOn } from './accessors'

export type KeystoreSnapshot = Parameters<typeof resolveSeedKeyFrom>[0]

export type SchemeChain = Pick<ChainDescriptor, 'id' | 'signing'> & {
    protocol: Pick<ChainDescriptor['protocol'], 'supportsNativeMultisig'>
}

const loadedSeedScheme = (
    keys: KeystoreSnapshot,
    keyPairId: string,
): SeedScheme | null => {
    try {
        return seedSchemeOf(resolveSeedKeyFrom(keys, keyPairId))
    } catch {
        return null
    }
}

/**
 * The scheme `account` signs with on `chain`, or `null` when it can't sign
 * there. A chain lists its primary scheme first. A local key follows its seed,
 * the kms signer's oracle; the custody stands in until the keystore loads.
 */
export const credentialScheme = (
    account: WalletAccount,
    chain: SchemeChain,
    keys: KeystoreSnapshot = getKeystoreStore().state.keys,
): SigningScheme | null => {
    const primary = chain.signing.schemes[0] ?? null
    const { custody } = account

    switch (custody.kind) {
        case 'hardware': {
            return primary
        }
        case 'multisig': {
            return chain.protocol.supportsNativeMultisig ? primary : null
        }
        case 'local': {
            const keyPairId = signingKeyOn(account, chain.id)
            if (!keyPairId) return null
            const seed = loadedSeedScheme(keys, keyPairId) ?? custody.seed
            // A chain with no accounts adapter declares no key kinds, so its
            // keys sign with its primary scheme.
            const scheme = accountsChainAdapters.has(chain.id)
                ? (localKeyKindOf(chain.id, seed)?.signingScheme ?? null)
                : primary
            return scheme && chain.signing.schemes.includes(scheme)
                ? scheme
                : null
        }
        default: {
            return null
        }
    }
}

/**
 * Whether `account` signs on `chainId` with a scheme other than the chain's
 * primary one. Fees are priced per signature by scheme, so this is what makes
 * an account pay a scheme premium.
 */
export const usesNonPrimaryScheme = (
    account: WalletAccount,
    chainId: ChainId,
    keys?: KeystoreSnapshot,
): boolean => {
    const chain = getProvider().chains.get(chainId).descriptor
    const scheme = credentialScheme(account, chain, keys)
    return scheme !== null && scheme !== chain.signing.schemes[0]
}
