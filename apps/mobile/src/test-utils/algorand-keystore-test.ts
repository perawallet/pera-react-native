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

// Test implementation of `@algorandfoundation/react-native-keystore`.
//
// The production package backs the keystore with MMKV (encrypted at rest via
// AES-256-GCM, master key in iOS Keychain / Android Keystore). None of that
// runs under jsdom, but the API surface is small enough to reproduce with an
// in-memory map. Tests can exercise the real `kms` package and the real
// `useKMS()` hook end-to-end against this stand-in.
//
// Aliased into the test build via apps/mobile/vitest.config.ts.

import { KeyContext, XHDWalletAPI } from '@algorandfoundation/xhd-wallet-api'
import { crypto_sign_keypair } from '@algorandfoundation/xhd-wallet-api/dist/sumo.facade.js'
import { type Optional } from '@perawallet/wallet-core-shared'

// Types come from `@tanstack/store` and `@algorandfoundation/keystore`,
// which are transitive deps not listed in apps/mobile's package.json. tsc
// would refuse those imports here, so we declare loose local shapes — the
// kms package validates the shapes at the boundary anyway.
type Store<T> = {
    state: T
    setState: (updater: (s: T) => T) => void
    subscribe: (listener: () => void) => { unsubscribe: () => void }
}
type Key = { id: string; type: string; [k: string]: unknown }

type KeyData = Key & {
    privateKey?: Uint8Array
    publicKey?: Uint8Array
    seed?: Uint8Array
    metadata?: {
        parentKeyId?: string
        account?: number
        index?: number
        context?: number
        derivation?: number
        [k: string]: unknown
    }
}
type KeyStoreState = { keys: Key[]; status: string }

// Module-level in-memory key map. Mirrors what production stores in MMKV
// (minus encryption). Keep this exported so tests can reset between runs
// if they care about isolation: `resetTestKeystore()` below.
const keyData = new Map<string, KeyData>()

// MMKV-shaped storage used by `singleton.hydrateKeystore()` in production.
// Tests don't actually hydrate from "previous sessions" — each run starts
// clean — but we still need the surface so the import doesn't crash.
export const storage = {
    getString: (key: string): Optional<string> => {
        const entry = keyData.get(key)
        return entry ? JSON.stringify(entry, replaceUint8Array) : undefined
    },
    set: (key: string, value: string): void => {
        keyData.set(key, JSON.parse(value, reviveUint8Array) as KeyData)
    },
    delete: (key: string): void => {
        keyData.delete(key)
    },
    contains: (key: string): boolean => keyData.has(key),
    getAllKeys: (): string[] => Array.from(keyData.keys()),
    clearAll: (): void => {
        keyData.clear()
    },
}

// Master key plumbing — returned for compatibility with `hydrateKeystore`,
// which decrypts MMKV entries with it. Our storage is plaintext, so the key
// is meaningless; the encrypt/decrypt funcs just pass through.
const TEST_MASTER_KEY = Buffer.alloc(32)
export const readMasterKey = async (): Promise<Buffer> => TEST_MASTER_KEY
export const sealData = async (
    _subtle: SubtleCrypto,
    _key: Buffer | Uint8Array,
    data: string,
): Promise<string> => data
export const openData = async (
    _subtle: SubtleCrypto,
    _key: Buffer | Uint8Array,
    payload: string,
): Promise<string> => payload
export const encode = (key: KeyData): string =>
    JSON.stringify(key, replaceUint8Array)
export const decode = (data: string): KeyData =>
    JSON.parse(data, reviveUint8Array) as KeyData

// canary.14 builds the engine outside `WithKeyStore`, and the provider
// singleton constructs one at module scope. Every operation still routes
// through the `WithKeyStore` api below, so this only has to answer the two
// lifecycle members the singleton itself reaches for.
export const createReactNativeKeyStore = (options: {
    store: Store<KeyStoreState>
}): { ready: Promise<void>; clear: () => Promise<void> } => ({
    ready: Promise.resolve(),
    clear: () => clear({ store: options.store }),
})

// Mutates the reactive store with the metadata representation of a Key
// (privateKey/seed bytes are stripped from the metadata mirror — kept only
// in the in-memory `keyData` map, which is what `export()` reads from).
const upsertReactiveKey = (
    store: Store<KeyStoreState>,
    data: KeyData,
): void => {
    const { privateKey: _pk, ...meta } = data as KeyData & {
        seed?: Uint8Array
    }
    delete (meta as { seed?: unknown }).seed
    const key = meta as Key
    store.setState((s: KeyStoreState) => ({
        ...s,
        keys: [...s.keys.filter(k => k.id !== key.id), key],
    }))
}

export const commit = async ({
    store,
    keyData: data,
}: {
    store: Store<KeyStoreState>
    keyData: KeyData
}): Promise<void> => {
    // Defensive clone. Production MMKV serializes on import, so the caller is
    // free to zero the source `privateKey` / `entropy` buffers afterwards
    // (the HD wallet path does exactly that). The in-memory map would
    // otherwise hold a reference to the same buffer and observe the zeroing —
    // silently corrupting the stored entropy/seed bytes — so we deep-clone
    // to mirror MMKV's copy-on-write semantics.
    keyData.set(data.id, cloneKeyData(data))
    upsertReactiveKey(store, data)
}

export const removeKey = async ({
    store,
    keyId,
}: {
    store: Store<KeyStoreState>
    keyId: string
}): Promise<void> => {
    keyData.delete(keyId)
    store.setState((s: KeyStoreState) => ({
        ...s,
        keys: s.keys.filter(k => k.id !== keyId),
    }))
}

export const clear = async ({
    store,
}: {
    store: Store<KeyStoreState>
}): Promise<void> => {
    keyData.clear()
    store.setState((s: KeyStoreState) => ({ ...s, keys: [] }))
}

// Used by secrets.withSecret via `getProvider().key.store.export(id)`.
// Returns the full KeyData including privateKey — caller is expected to zero
// the bytes after use.
const exportKey = async (id: string): Promise<KeyData> => {
    const entry = keyData.get(id)
    if (!entry) throw new Error(`Key not found: ${id}`)
    // Return a defensive copy so the caller zeroing the bytes doesn't wipe
    // our in-memory record.
    return cloneKeyData(entry)
}

// `WithKeyStore` extension. Production wires this via `Provider.withExtensions
// ([WithPlatformExtension, ..., WithKeyStore])`. The extension reads the
// `keystore.store` option and exposes it (plus a KeyStoreAPI surface) on the
// provider instance. We provide enough of that surface for `typedSecret.ts`
// and the kms hooks to function.
//
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const WithKeyStore = (_provider: any, options: any) => {
    const reactiveStore: Optional<Store<KeyStoreState>> =
        options?.keystore?.store

    if (reactiveStore) reactiveStoreRef = reactiveStore
    const hooks = options?.keystore?.hooks

    const xhdApi = new XHDWalletAPI()
    let derivedSeq = 0
    const newDerivedKeyId = (): string =>
        `test-derived-${Date.now().toString(36)}-${++derivedSeq}`

    const api = {
        // Mirrors the production keystore's `generate` for the two derived
        // key types the kms layer mints:
        // - `ed25519` (standalone signing child of an algo25 seed) — derives
        //   the keypair from `parentKey.privateKey.slice(0, 32)` via tweetnacl.
        // - `hd-derived-ed25519` (XHD child of a bip39 seed) — derives the
        //   public key via the same `XHDWalletAPI.keyGen` call as the real
        //   keystore. Other types throw — flow tests should opt in.
        async generate(options: {
            type?: string
            extractable?: boolean
            keyUsages?: string[]
            algorithm?: string
            params?: {
                id?: string
                parentKeyId?: string
                account?: number
                index?: number
                context?: number
                derivation?: number
                value?: Uint8Array | string
                params?: {
                    value?: Uint8Array | string
                    metadata?: Record<string, unknown>
                }
            }
        }): Promise<string> {
            const type = options?.type
            const params = options?.params ?? {}

            if (!reactiveStore) throw new Error('Keystore store missing')

            if (type === 'secret-key') {
                // Mirrors `generateSecretKey` in the real keystore: read the
                // value and metadata from `params.params` (the rn-keystore
                // wraps caller params there) and commit a secret-key entry,
                // carrying the metadata onto the key so it's queryable on the
                // reactive snapshot. No parent required.
                const valueSrc = params.params?.value ?? params.value
                const value =
                    typeof valueSrc === 'string'
                        ? new TextEncoder().encode(valueSrc)
                        : valueSrc instanceof Uint8Array
                          ? valueSrc
                          : new Uint8Array(0)
                const id = params.id ?? newDerivedKeyId()
                const entry: KeyData = {
                    id,
                    type: 'secret-key',
                    privateKey: new Uint8Array(value),
                    ...(params.params?.metadata
                        ? { metadata: params.params.metadata }
                        : {}),
                }
                await commit({ store: reactiveStore, keyData: entry })
                return id
            }

            const parentKeyId = params.parentKeyId
            if (!parentKeyId) {
                throw new Error(
                    'Test keystore: generate() requires params.parentKeyId',
                )
            }
            const parent = keyData.get(parentKeyId)
            if (!parent || !parent.privateKey) {
                throw new Error(
                    `Test keystore: parent key not found or missing privateKey: ${parentKeyId}`,
                )
            }

            if (type === 'ed25519') {
                // Mirrors `generateEd25519FromSeed` from the real keystore:
                // expand the first 32 bytes of the parent seed into an
                // Ed25519 keypair via the same xhd-wallet-api facade the
                // production rn-keystore goes through.
                const seedBytes = parent.privateKey.slice(0, 32)
                const { publicKey, secretKey } = crypto_sign_keypair(seedBytes)
                const id = params.id ?? newDerivedKeyId()
                const derived: KeyData = {
                    id,
                    type: 'ed25519',
                    publicKey: new Uint8Array(publicKey),
                    privateKey: new Uint8Array(secretKey),
                    metadata: { parentKeyId },
                }
                await commit({ store: reactiveStore, keyData: derived })
                return id
            }

            if (type === 'hd-derived-ed25519') {
                const account = params.account ?? 0
                const index = params.index ?? 0
                const context = (params.context ??
                    KeyContext.Address) as KeyContext
                const derivation = params.derivation ?? 0
                const publicKey = await xhdApi.keyGen(
                    parent.privateKey,
                    context,
                    account,
                    index,
                    derivation,
                )

                const id = params.id ?? newDerivedKeyId()
                const derived: KeyData = {
                    id,
                    type: 'hd-derived-ed25519',
                    publicKey,
                    metadata: {
                        parentKeyId,
                        account,
                        index,
                        context,
                        derivation,
                    },
                }
                await commit({
                    store: reactiveStore,
                    keyData: derived,
                })
                return id
            }

            throw new Error(
                `Test keystore: generate() supports 'ed25519' | 'hd-derived-ed25519' only, got: ${String(
                    type,
                )}`,
            )
        },
        // Mirrors `keyStore.deriveFromSeed` for HD wallets. Parses the BIP44
        // path to extract account/keyIndex, runs `xhdApi.keyGen`, and stores
        // the derived public key alongside its derivation coords.
        async deriveFromSeed(
            seedId: string,
            path: string,
            opts?: { mode?: string; id?: string },
        ): Promise<string> {
            if (!reactiveStore) throw new Error('Keystore store missing')
            const parent = keyData.get(seedId)
            if (!parent?.privateKey) {
                throw new Error(
                    `Test keystore: seed not found or missing privateKey: ${seedId}`,
                )
            }
            const parts = path
                .replace(/^m\/?/, '')
                .split('/')
                .map(s => {
                    const hardened = s.endsWith("'") || s.endsWith('h')
                    const v = parseInt(s.replace(/['h]$/, ''), 10)
                    return hardened ? v + 0x80_00_00_00 : v
                })
            const context =
                parts[1] === 0x80_00_01_1b
                    ? KeyContext.Address
                    : KeyContext.Identity
            const account = (parts[2] ?? 0x80_00_00_00) & 0x7f_ff_ff_ff
            const keyIndex = (parts[4] ?? 0) & 0x7f_ff_ff_ff
            const derivation = opts?.mode === 'standard' ? 32 : 9
            const publicKey = await xhdApi.keyGen(
                parent.privateKey,
                context,
                account,
                keyIndex,
                derivation,
            )

            const id = opts?.id ?? newDerivedKeyId()
            const derived: KeyData = {
                id,
                type: 'hd-derived-ed25519',
                publicKey,
                metadata: {
                    parentKeyId: seedId,
                    account,
                    index: keyIndex,
                    context,
                    derivation,
                },
            }
            await commit({ store: reactiveStore, keyData: derived })
            return id
        },
        async import(data: KeyData): Promise<string> {
            if (!reactiveStore) throw new Error('Keystore store missing')
            await commit({ store: reactiveStore, keyData: data })
            return data.id
        },
        export: exportKey,
        async remove(id: string): Promise<void> {
            if (!reactiveStore) throw new Error('Keystore store missing')
            await removeKey({ store: reactiveStore, keyId: id })
        },
        async sign(id: string, _data: Uint8Array): Promise<Uint8Array> {
            if (!keyData.has(id)) throw new Error(`Key not found: ${id}`)
            // 64-byte deterministic stub. Real flows that care about
            // signature contents should override at the test level.
            return new Uint8Array(64)
        },
        async verify(): Promise<boolean> {
            return true
        },
        async derive(_options: unknown): Promise<string> {
            throw new Error('Test keystore: derive() not implemented')
        },
        // The real `key.store` carries the same hook surface — used by kms to
        // wrap `signing` and friends. We attach the provider's hook collection
        // so wraps registered via `provider.key.store.hooks.wrap(...)` actually
        // route here.
        hooks,
    }

    // Reactive surface — kms's `useKeystoreKeys` reads `state.keys` via
    // `getKeystoreStore()`, which is sourced separately in `singleton.ts`,
    // not from this extension. So the `keys` / `status` properties below are
    // only for completeness with `KeyStoreExtension`.
    return {
        get keys(): Key[] {
            return reactiveStore?.state.keys ?? []
        },
        get status(): string {
            return reactiveStore?.state.status ?? 'idle'
        },
        key: { store: api },
    }
}

// Helpers

const replaceUint8Array = (_key: string, value: unknown): unknown => {
    if (value instanceof Uint8Array) {
        return { __u8: Array.from(value) }
    }
    return value
}

const reviveUint8Array = (_key: string, value: unknown): unknown => {
    if (
        value !== null &&
        typeof value === 'object' &&
        '__u8' in value &&
        Array.isArray((value as { __u8: unknown }).__u8)
    ) {
        return new Uint8Array((value as { __u8: number[] }).__u8)
    }
    return value
}

const cloneKeyData = (data: KeyData): KeyData => {
    const cloned = JSON.parse(
        JSON.stringify(data, replaceUint8Array),
        reviveUint8Array,
    ) as KeyData
    return cloned
}

// Test helper: clear all stored keys, including the reactive store's
// snapshot. Call from `afterEach` for isolation between tests sharing the
// provider singleton.
export const resetTestKeystore = (): void => {
    keyData.clear()
    reactiveStoreRef?.setState((s: KeyStoreState) => ({ ...s, keys: [] }))
}

// Tracked separately because `WithKeyStore` is the only place we have
// access to the reactive store; capture it on first init so the reset
// helper above can wipe it without a Provider re-bootstrap.
let reactiveStoreRef: Optional<Store<KeyStoreState>>
