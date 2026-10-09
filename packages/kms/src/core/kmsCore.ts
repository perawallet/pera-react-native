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

import type { Key } from '@algorandfoundation/keystore-core'
import {
    getKeystoreStore,
    getProvider,
} from '@perawallet/wallet-extension-provider'
import { expiresAtOf } from '../utils'
import { createAlgo25Key, type Algo25KeyParams } from './algo25Key'
import { createKmsCore } from './createKmsCore'
import { createQuantumKey, type QuantumKeyParams } from './quantumKey'
import { parentIdOf } from './resolveSeed'

const core = createKmsCore({
    keyStore: () => getProvider().key.store,
    keys: () => getKeystoreStore().state.keys,
})

/** `null` for a missing key or a seed past its expiry; unlike `useKMS().getKey`, never removes it. */
const getKey = (keyId: string): Key | null => {
    const keys = getKeystoreStore().state.keys
    const key = keys.find(k => k.id === keyId)
    if (!key) return null
    const parentId = parentIdOf(key)
    const seed = parentId ? keys.find(k => k.id === parentId) : key
    const expiresAt = seed ? expiresAtOf(seed) : undefined
    return expiresAt && Date.now() > expiresAt.getTime() ? null : key
}

/**
 * Removes a seed a creation flow just minted, with its direct children, when
 * the account it backs can't be saved. Never for a wallet's seed: the
 * passkey main key hangs off those, and `useKMS().removeKeyAndChildren`
 * re-mints it.
 */
const discardMintedSeed = async (seedKeyId: string): Promise<void> => {
    const keyStore = getProvider().key.store
    const children = getKeystoreStore().state.keys.filter(
        k => parentIdOf(k) === seedKeyId,
    )
    for (const child of children) {
        await keyStore.remove(child.id)
    }
    await keyStore.remove(seedKeyId)
}

/**
 * The KMS for callers that can't use hooks, such as chain adapters. Every
 * operation resolves the governing seed and runs its ACL check before the
 * keystore is reached.
 */
export const kmsCore = {
    deriveFromSeed: core.deriveFromSeed,
    importRawKey: core.importRawKey,
    sign: core.sign,
    getKey,
    createAlgo25Key: (params?: Algo25KeyParams) =>
        createAlgo25Key(getProvider().key.store, params),
    createQuantumKey: (params: QuantumKeyParams) =>
        createQuantumKey(getProvider().key.store, params),
    discardMintedSeed,
}
