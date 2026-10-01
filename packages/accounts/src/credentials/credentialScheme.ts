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
import { FALCON_CHILD_KEY_TYPE, SeedScheme } from '@perawallet/wallet-core-kms'
import { getKeystoreStore } from '@perawallet/wallet-extension-provider'
import type { SigningCredential } from '../models'

type KeystoreEntry = { id: string; type: string }

/**
 * The signature scheme a credential signs with. Never persisted: for a local
 * key it is the KMS entry's type. The keystore loads asynchronously after the
 * accounts store hydrates, so until the entry is present the seed provenance
 * stands in for it.
 */
export const credentialScheme = (
    credential: SigningCredential,
    keys: readonly KeystoreEntry[] = getKeystoreStore().state.keys,
): SigningScheme => {
    if (credential.kind !== 'local') return 'ed25519'

    const entryType = keys.find(k => k.id === credential.keyPairId)?.type
    if (entryType === FALCON_CHILD_KEY_TYPE) return 'falcon-1024'
    if (entryType !== undefined) return 'ed25519'

    return credential.provenance === SeedScheme.Quantum
        ? 'falcon-1024'
        : 'ed25519'
}
