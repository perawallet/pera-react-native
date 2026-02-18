/*
 Copyright 2022-2025 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
 */

import {
    clearKeyData,
    decrypt,
    encrypt,
    InvalidKeyDataError,
    type KeyData,
    type KeyId,
    KeyNotFoundError,
    type KeyStoreAPI,
    type KeyStoreExtension,
    type KeyStoreOptions,
    requiresParentKey,
    sign,
    signWithKeyData,
    verify,
    type XHDDerivedKeyData,
    type XHDPasskey,
} from '@algorandfoundation/keystore'
import type { LogStoreExtension } from '@algorandfoundation/log-store'
import type { Extension, Provider } from '@algorandfoundation/wallet-provider'

import { context } from './constants.ts'
import { fetchSecret } from './storage/state.ts'
import * as store from './store.ts'

/**
 * Wallet Provider Extension that adds Keystore functionality.
 *
 * It wraps a {@link KeyStoreAPI} to provide reactive state for keys and status,
 * and adds a hook system for intercepting operations.
 *
 * @param provider
 * @param options - Extension options
 * @param options.keystore.extension - The {@link KeyStoreAPI} extension configuration
 * @param options.api.keystore - The concrete {@link KeyStoreAPI} implementation to wrap
 *
 * @returns The {@link KeyStoreExtension} surface with reactive `keys` and an augmented `keystore` API.
 *
 * @example
 * ```typescript
 * const ProviderWithKeystore = Provider.withExtensions([WithKeyStore]);
 * const provider = new ProviderWithKeystore({
 *   api: { keystore: myKeystoreAPI }
 * });
 *
 * // Add hooks
 * provider.keystore.hooks.before("signing", ({ id }) => {
 *   console.log("About to sign with", id)
 * })
 * ```
 */
export const WithKeyStore: Extension<KeyStoreExtension> = (
    provider: Provider<any> & LogStoreExtension,
    options: KeyStoreOptions,
) => {
    const keyStore = options.keystore.store
    const keyStoreHooks = options.keystore.hooks
    const log = provider?.log || console

    // Implement the extension surface with hooks
    return {
        /** Reactive state of all keys in the keystore */
        get keys() {
            return keyStore.state.keys
        },
        /** Reactive status of the keystore (e.g., 'idle', 'commiting') */
        get status() {
            return keyStore.state.status
        },
        /**
         * The Keystore API for performing cryptographic operations.
         * Maps to the underlying {@link KeyStoreAPI} implementation.
         */
        key: {
            store: options?.api?.keystore || {
                /** Generates a new key pair and stores it */
                generate: (options): Promise<KeyId> => {
                    log.debug('(extension.ts) Generating Key', options, context)

                    if (
                        requiresParentKey(options) &&
                        typeof options?.params?.parentKeyId === 'undefined'
                    ) {
                        throw new InvalidKeyDataError(
                            'Parent key ID is required for generating derived keys',
                        )
                    }

                    return keyStoreHooks('generate', store.generateKey, {
                        log,
                        store: keyStore,
                        type: options.type,
                        params: options.params,
                        extractable: options.extractable,
                        algorithm: options.algorithm,
                        keyUsages: options.keyUsages,
                    })
                },
                /** Imports an existing key into the keystore */
                import: (data, _format): Promise<KeyId> => {
                    log.debug(
                        '(extension.ts) Import Key',
                        typeof data === 'string' || data instanceof Uint8Array
                            ? { type: 'raw' }
                            : {
                                  ...data.metadata,
                                  type: (data as any).type,
                                  algorithm: (data as any).algorithm,
                              },
                        context,
                    )
                    if (
                        typeof data !== 'string' &&
                        !(data instanceof Uint8Array) &&
                        (!(data.privateKey instanceof Uint8Array) ||
                            data.privateKey instanceof Buffer)
                    ) {
                        throw new InvalidKeyDataError(
                            'Invalid key data format, must be string, Uint8Array, or have Uint8Array privateKey property',
                        )
                    }
                    return store.importKey({ store: keyStore, keyData: data })
                },
                /** Exports public key data for a given key ID */
                export: (id, options): Promise<KeyData> =>
                    store.exportKey({ store: keyStore, id, options }),
                /** Removes a key from the keystore */
                remove: id =>
                    keyStoreHooks(
                        'remove',
                        async function handleRemove({
                            keyId,
                        }: {
                            keyId: KeyId
                        }) {
                            await store.removeKey({ store: keyStore, keyId })
                        },
                        { keyId: id },
                    ),
                /** Clears all keys from the keystore */
                clear: () =>
                    keyStoreHooks(
                        'clear',
                        async function handleClear() {
                            await store.clear({ store: keyStore })
                        },
                        {},
                    ),
                /** Signs data using the private key associated with the ID */
                sign: (id, data): Promise<Uint8Array<ArrayBufferLike>> =>
                    keyStoreHooks(
                        'sign',
                        async function handleSign({
                            id,
                            data,
                        }: {
                            id: string
                            data: Uint8Array<ArrayBufferLike>
                        }) {
                            let key: KeyData | null = null
                            let parentKey: KeyData | null = null
                            try {
                                key = await fetchSecret<KeyData>({ keyId: id })
                                if (!key) {
                                    throw new KeyNotFoundError(id)
                                }
                                // We can assume if it has a parent key that it is an HD key
                                if (
                                    typeof key?.metadata !== 'undefined' &&
                                    typeof key?.metadata?.parentKeyId !==
                                        'undefined'
                                ) {
                                    parentKey = await fetchSecret<KeyData>({
                                        keyId: (
                                            key as
                                                | XHDDerivedKeyData
                                                | XHDPasskey
                                        ).metadata.parentKeyId,
                                    })
                                    if (!parentKey)
                                        throw new KeyNotFoundError(
                                            (
                                                key as
                                                    | XHDDerivedKeyData
                                                    | XHDPasskey
                                            ).metadata.parentKeyId,
                                        )
                                }
                                if (!parentKey) {
                                    throw new InvalidKeyDataError(
                                        'Missing parent key for HD key',
                                    )
                                }
                                return sign({
                                    store: keyStore,
                                    key,
                                    parentKey,
                                    data,
                                })
                            } finally {
                                clearKeyData(key)
                                clearKeyData(parentKey)
                            }
                        },
                        { id, data },
                    ),
                /** Verifies a signature against data using the key associated with the ID */
                verify: (id, data, signature, algorithm): Promise<boolean> =>
                    keyStoreHooks('verify', async () => {
                        let key: KeyData | null = null
                        try {
                            // Fetch the key from storage
                            key = await fetchSecret<KeyData>({ keyId: id })
                            if (!key) throw new KeyNotFoundError(id)
                            // Verify the signature
                            return verify({
                                store: keyStore,
                                key,
                                data,
                                signature,
                                algorithm,
                            })
                        } finally {
                            clearKeyData(key)
                        }
                    }),
                /** Imports a raw seed or BIP39 mnemonic for HD wallet derivation */
                importSeed: (seed, options): Promise<KeyId> =>
                    store.importSeed({
                        store: keyStore,
                        seed,
                        name: options?.name,
                    }),
                /** Derives a new key from a stored seed using a path */
                deriveFromSeed: (seedId, path, options): Promise<KeyId> =>
                    keyStoreHooks('deriveFromSeed', store.deriveFromSeed, {
                        store: keyStore,
                        seedId,
                        path,
                        options,
                    }),
                /** Encrypts data using the key associated with the ID */
                encryptWithKey: (
                    id,
                    data,
                    algorithm,
                ): Promise<Uint8Array<ArrayBufferLike>> =>
                    keyStoreHooks('encryptWithKey', async () => {
                        let key: KeyData | null = null
                        try {
                            key = await fetchSecret<KeyData>({ keyId: id })
                            if (!key) throw new KeyNotFoundError(id)
                            return encrypt({
                                store: keyStore,
                                key,
                                data,
                                algorithm,
                            })
                        } finally {
                            clearKeyData(key)
                        }
                    }),
                /** Decrypts data using the key associated with the ID */
                decryptWithKey: (
                    id,
                    data,
                    algorithm,
                ): Promise<Uint8Array<ArrayBufferLike>> =>
                    keyStoreHooks(
                        'decryptWithKey',
                        async () => {
                            let key: KeyData | null = null
                            try {
                                key = await fetchSecret<KeyData>({ keyId: id })
                                if (!key) throw new KeyNotFoundError(id)
                                return decrypt({
                                    store: keyStore,
                                    key,
                                    data,
                                    algorithm,
                                })
                            } finally {
                                clearKeyData(key)
                            }
                        },
                        {
                            store: keyStore,
                            id,
                            data,
                            algorithm,
                        },
                    ),
                /** Signs multiple data items using multiple key IDs */
                batchSign: (
                    ids,
                    data,
                ): Promise<Uint8Array<ArrayBufferLike>[]> =>
                    keyStoreHooks(
                        'batchSign',
                        async ({
                            ids,
                            data,
                        }: {
                            ids: KeyId[]
                            data: Uint8Array<ArrayBufferLike>[]
                        }) => {
                            let keys: (KeyData | null)[] = []
                            let parentKeys: (KeyData | null)[] = []
                            try {
                                keys = await Promise.all(
                                    ids.map(id =>
                                        fetchSecret<KeyData>({ keyId: id }),
                                    ),
                                )
                                parentKeys = await Promise.all(
                                    keys.map(key =>
                                        fetchSecret<KeyData>({
                                            keyId: (
                                                key as
                                                    | XHDDerivedKeyData
                                                    | XHDPasskey
                                            ).metadata.parentKeyId,
                                        }),
                                    ),
                                )
                                return Promise.all(
                                    keys.map((key, i) => {
                                        return key
                                            ? signWithKeyData({
                                                  key,
                                                  data: data[
                                                      i
                                                  ] as Uint8Array<ArrayBufferLike>,
                                                  parentKey: parentKeys[
                                                      i
                                                  ] as KeyData,
                                              })
                                            : null
                                    }),
                                )
                            } finally {
                                keys.map(clearKeyData)
                                parentKeys.map(clearKeyData)
                            }
                        },
                        {
                            ids,
                            data,
                        },
                    ),
                hooks: keyStoreHooks,
            },
        },
    } as KeyStoreExtension
}
