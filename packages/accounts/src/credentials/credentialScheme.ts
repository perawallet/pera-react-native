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
    SigningScheme,
} from '@perawallet/wallet-core-chain-contract'
import {
    resolveSeedKeyFrom,
    SeedScheme,
    seedSchemeOf,
} from '@perawallet/wallet-core-kms'
import { getKeystoreStore } from '@perawallet/wallet-extension-provider'
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
            const scheme = seed === SeedScheme.Quantum ? 'falcon-1024' : primary
            return scheme && chain.signing.schemes.includes(scheme)
                ? scheme
                : null
        }
        default: {
            return null
        }
    }
}
