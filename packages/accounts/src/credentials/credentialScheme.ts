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

import type { SigningScheme } from '@perawallet/wallet-core-chain-contract'
import {
    resolveSeedKeyFrom,
    SeedScheme,
    seedSchemeOf,
} from '@perawallet/wallet-core-kms'
import { getKeystoreStore } from '@perawallet/wallet-extension-provider'
import type { SigningCredential } from '../models'

type KeystoreSnapshot = Parameters<typeof resolveSeedKeyFrom>[0]

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

// Follows the seed's scheme, the kms signer's oracle, so the two can't disagree;
// provenance stands in until the keystore holds the seed.
export const credentialScheme = (
    credential: SigningCredential,
    keys: KeystoreSnapshot = getKeystoreStore().state.keys,
): SigningScheme => {
    if (credential.kind !== 'local') return 'ed25519'

    const scheme =
        loadedSeedScheme(keys, credential.keyPairId) ?? credential.provenance
    return scheme === SeedScheme.Quantum ? 'falcon-1024' : 'ed25519'
}
