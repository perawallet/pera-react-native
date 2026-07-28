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

import { getKeystoreStore } from '@perawallet/wallet-extension-provider'
import { FALCON_CHILD_KEY_TYPE } from '../models'

/**
 * Persists the quantum signing child as a keystore entry with
 * `type: 'falcon1024'` (the concrete algorithm lives on the entry — the id is
 * the scheme-agnostic `quantumSignKeyId`).
 *
 * This uses the keystore's low-level `commit` rather than `keyStore.generate`
 * because `@algorandfoundation/keystore` ships generators for seed, ed25519,
 * XHD-root and secret-key only — there is no Falcon generator to call. The
 * entry itself is not a stand-in: it holds a real Falcon public key, in the
 * same encrypted namespace as every other entry, and `hydrateKeystore`
 * restores it on cold start like any other. The child carries no private
 * material; signing re-derives the keypair from the parent seed.
 *
 * When the keystore gains a Falcon key type, this becomes a
 * `keyStore.generate` call and this note goes away.
 *
 * `@algorandfoundation/react-native-keystore` is imported lazily on purpose:
 * its module scope instantiates MMKV, which breaks sibling-package vitest
 * runs if it becomes statically reachable through the kms barrel (see the
 * note at the bottom of `src/index.ts`).
 */
export const commitQuantumChildKey = async (params: {
    id: string
    parentKeyId: string
    publicKey: Uint8Array
}): Promise<void> => {
    const { commit } = await import('@algorandfoundation/react-native-keystore')
    await commit({
        store: getKeystoreStore(),
        keyData: {
            id: params.id,
            type: FALCON_CHILD_KEY_TYPE,
            algorithm: 'raw',
            format: 'raw',
            extractable: false,
            keyUsages: ['sign'],
            publicKey: params.publicKey,
            metadata: {
                parentKeyId: params.parentKeyId,
                createdAt: new Date().toISOString(),
            },
        },
    })
}
