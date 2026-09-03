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
import { sha512 } from '@noble/hashes/sha2'
import type { Optional } from '@perawallet/wallet-core-shared'

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
type KeyStoreCapability = { algorithm: string; source: 'host' | 'shim' }
type KeyStoreState = {
    keys: Key[]
    status: string
    algorithms?: KeyStoreCapability[]
}

// Mirrors `DEFAULT_HOST_ALGORITHMS` plus the React Native engine's default shim
// stack, which is what `state.algorithms` reports once `ready` resolves. Falcon
// is the one entry tests actually assert on: on device it only appears when the
// native binding resolved, so a UI gating quantum on it must see it here too.
const ALGORITHMS: KeyStoreCapability[] = [
    { algorithm: 'Ed25519', source: 'host' },
    { algorithm: 'ECDSA', source: 'host' },
    { algorithm: 'ECDH', source: 'host' },
    { algorithm: 'RSASSA-PKCS1-v1_5', source: 'host' },
    { algorithm: 'AES-GCM', source: 'host' },
    { algorithm: 'BIP32-Ed25519', source: 'shim' },
    { algorithm: 'Falcon-1024', source: 'shim' },
    { algorithm: 'Deterministic-P256', source: 'shim' },
    { algorithm: 'BIP39', source: 'shim' },
    { algorithm: 'Algo25', source: 'shim' },
]

const FALCON_KEY_TYPE = 'falcon-1024'

// Length of a real compressed Falcon-1024 signature for this build (max 1423,
// typical 1228). Size-sensitive flows assert on it — the WC PQ-fee test checks
// the quantum slot's carrier is >1000 bytes — so the double must not emit a
// 64-byte stub the way it does for Ed25519.
const FALCON_SIGNATURE_BYTES = 1228

/**
 * A Falcon-SHAPED signature: correct length, stable per (secret key, payload),
 * and different for a different payload — but not a verifiable Falcon
 * signature. That is deliberate. Real signatures would have to come from the
 * Falcon library, which only `packages/kms/src/crypto/pq` may import, and the
 * production keystore signs from sealed material that never reaches JS, so
 * there is no `sign(secretKey, …)` entry point left to borrow. Keystore-Falcon
 * byte parity is proven where it is meaningful, in
 * `packages/kms/src/crypto/pq/__tests__/keystoreFalconParity.spec.ts`; nothing
 * in the integration suite verifies a signature cryptographically.
 */
const falconShapedSignature = (
    secretKey: Uint8Array,
    data: Uint8Array,
): Uint8Array => {
    const signature = new Uint8Array(FALCON_SIGNATURE_BYTES)
    for (let offset = 0, counter = 0; offset < signature.length; counter++) {
        const block = sha512
            .create()
            .update(secretKey)
            .update(data)
            .update(Uint8Array.of(counter))
            .digest()
        signature.set(block.subarray(0, signature.length - offset), offset)
        offset += block.length
    }
    return signature
}

// Reached through kms's PQ seam rather than the Falcon library directly: the
// seam is the only sanctioned home for that import (see
// `packages/blockchain/src/pq/__tests__/pqLibraryFirewall.spec.ts`), and going
// through it is also what guarantees a child minted here lands on the address
// the shared quantum fixture derives. Imported lazily because kms reaches the
// provider singleton, which imports this module — a top-level import would
// close the cycle at module-evaluation time.
const loadPQProvider = async () =>
    (await import('@perawallet/wallet-core-kms')).getPQProvider()

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

// canary.14 builds the engine outside `WithKeyStore` and the provider singleton
// hands the result back in as `options.api.keystore`, so the engine — not the
// extension — owns every operation. The double has to be built the same way, or
// integration tests would exercise an API object production never reaches.
export const createReactNativeKeyStore = (options: {
    store: Store<KeyStoreState>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    hooks?: any
    subtle?: SubtleCrypto
}): TestKeyStore => {
    reactiveStoreRef = options.store
    // The real engine publishes `algorithms` onto the reactive store as part of
    // `ready`, once its shim stack is layered. Nothing here is async, so this
    // merges rather than replacing state — the engine's clobbering write is a
    // hydration detail the double has no persisted metadata to reproduce.
    options.store.setState((s: KeyStoreState) => ({
        ...s,
        algorithms: ALGORITHMS,
    }))
    return {
        ...createKeyStoreApi(options.store, options.hooks),
        ready: Promise.resolve(),
    }
}

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

// Returns the full KeyData including privateKey — caller is expected to zero
// the bytes after use. Note the real canary.14 `export` returns public
// metadata ONLY; secrets are read back through `secrets.get` instead.
const exportKey = async (id: string): Promise<KeyData> => {
    const entry = keyData.get(id)
    if (!entry) throw new Error(`Key not found: ${id}`)
    // Return a defensive copy so the caller zeroing the bytes doesn't wipe
    // our in-memory record.
    return cloneKeyData(entry)
}

export type TestKeyStore = ReturnType<typeof createKeyStoreApi> & {
    ready: Promise<void>
}

// The `KeyStoreAPI` surface the engine owns. `createReactNativeKeyStore` builds
// it (matching production, where the singleton passes the result in as
// `options.api.keystore`); `WithKeyStore` only falls back to building its own
// when no backend was injected.
const createKeyStoreApi = (
    reactiveStore: Store<KeyStoreState>,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    hooks?: any,
) => {
    const xhdApi = new XHDWalletAPI()
    let derivedSeq = 0
    const newDerivedKeyId = (): string =>
        `test-derived-${Date.now().toString(36)}-${++derivedSeq}`

    return {
        // Mirrors the production keystore's `generate` for the derived key
        // types the kms layer mints:
        // - `ed25519` (standalone signing child of an algo25 seed) — derives
        //   the keypair from `parentKey.privateKey.slice(0, 32)` via tweetnacl.
        // - `hd-derived-ed25519` (XHD child of a bip39 seed) — derives the
        //   public key via the same `XHDWalletAPI.keyGen` call as the real
        //   keystore.
        // - the Falcon quantum signing child — derives the real Falcon keypair
        //   from the seed, so the addresses the flow tests assert are the ones
        //   a real keystore would mint.
        // Other types throw — flow tests should opt in.
        async generate(
            options: {
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
                    seed?: Uint8Array
                    value?: Uint8Array | string
                    params?: {
                        value?: Uint8Array | string
                        metadata?: Record<string, unknown>
                    }
                }
            },
            _ctx?: unknown,
        ): Promise<string> {
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

            if (type === FALCON_KEY_TYPE) {
                // The engine resolves the seed from `params.seed` and falls
                // back to the parent's stored bytes. These deliberately
                // diverge: `params.seed` is the caller's
                // already-canonicalized keygen seed, while the fallback is
                // the raw parent entropy (legacy derivation) — same Falcon-1024
                // primitive, different input, different minted address.
                const seed = params.seed ?? parent.privateKey
                const { publicKey, secretKey } = (
                    await loadPQProvider()
                ).generateKeypairFromSeed(new Uint8Array(seed))
                const id = params.id ?? newDerivedKeyId()
                const derived: KeyData = {
                    id,
                    type: FALCON_KEY_TYPE,
                    algorithm: 'Falcon-1024',
                    publicKey: new Uint8Array(publicKey),
                    privateKey: new Uint8Array(secretKey),
                    metadata: { parentKeyId },
                }
                await commit({ store: reactiveStore, keyData: derived })
                return id
            }

            throw new Error(
                `Test keystore: generate() supports 'ed25519' | 'hd-derived-ed25519' | '${FALCON_KEY_TYPE}' only, got: ${String(
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
            _ctx?: unknown,
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
        async import(
            data: KeyData,
            _format?: string,
            _ctx?: unknown,
        ): Promise<string> {
            await commit({ store: reactiveStore, keyData: data })
            return data.id
        },
        async export(
            id: string,
            _options?: unknown,
            _ctx?: unknown,
        ): Promise<KeyData> {
            return exportKey(id)
        },
        async remove(id: string, _ctx?: unknown): Promise<void> {
            await removeKey({ store: reactiveStore, keyId: id })
        },
        // Secrets are the one entry kind the engine reads back in plaintext,
        // so they get their own channel rather than riding `export`.
        secrets: {
            async put(
                value: Uint8Array | string,
                options?: { id?: string; metadata?: Record<string, unknown> },
                _ctx?: unknown,
            ): Promise<string> {
                const id = options?.id ?? newDerivedKeyId()
                const bytes =
                    typeof value === 'string'
                        ? new TextEncoder().encode(value)
                        : Uint8Array.from(value)
                await commit({
                    store: reactiveStore,
                    keyData: {
                        id,
                        type: 'secret-key',
                        algorithm: 'raw',
                        extractable: true,
                        keyUsages: [],
                        privateKey: bytes,
                        metadata: { storage: 'bytes', ...options?.metadata },
                    } as KeyData,
                })
                return id
            },
            async get(id: string, _ctx?: unknown): Promise<Uint8Array> {
                const entry = keyData.get(id)
                if (!entry?.privateKey)
                    throw new Error(`Secret not found: ${id}`)
                // Defensive copy: the caller zeroes these bytes after use.
                return Uint8Array.from(entry.privateKey)
            },
            async remove(id: string, _ctx?: unknown): Promise<void> {
                await removeKey({ store: reactiveStore, keyId: id })
            },
            async list(): Promise<Key[]> {
                return reactiveStore.state.keys.filter(
                    k => k.type === 'secret-key',
                )
            },
        },
        // canary.14 puts `ctx` LAST: `sign(id, data, algorithm?, ctx?)`. Keep
        // the arity — a caller written against the old `(id, ctx, data)` order
        // would otherwise pass here and fail against the real library.
        async sign(
            id: string,
            data: Uint8Array,
            _algorithm?: string,
            _ctx?: unknown,
        ): Promise<Uint8Array> {
            const entry = keyData.get(id)
            if (!entry) throw new Error(`Key not found: ${id}`)
            if (entry.type === FALCON_KEY_TYPE && entry.privateKey) {
                return falconShapedSignature(entry.privateKey, data)
            }
            // 64-byte deterministic stub. Real flows that care about
            // signature contents should override at the test level.
            return new Uint8Array(64)
        },
        async verify(
            id: string,
            _data: Uint8Array,
            _signature: Uint8Array,
            _algorithm?: string,
        ): Promise<boolean> {
            return keyData.has(id)
        },
        async derive(_options: unknown): Promise<string> {
            throw new Error('Test keystore: derive() not implemented')
        },
        async clear(_ctx?: unknown): Promise<void> {
            await clear({ store: reactiveStore })
        },
        // The real `key.store` carries the same hook surface — used by kms to
        // wrap `signing` and friends. We attach the provider's hook collection
        // so wraps registered via `provider.key.store.hooks.wrap(...)` actually
        // route here.
        hooks,
    }
}

// `WithKeyStore` extension. Production wires this via `Provider.withExtensions
// ([WithPlatformExtension, ..., WithKeyStore])` and passes the engine it already
// built as `options.api.keystore`, which the extension then uses as-is.
//
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const WithKeyStore = (_provider: any, options: any) => {
    const reactiveStore: Store<KeyStoreState> = options?.keystore?.store
    if (reactiveStore) reactiveStoreRef = reactiveStore

    const keystore =
        options?.api?.keystore ??
        createReactNativeKeyStore({
            store: reactiveStore,
            hooks: options?.keystore?.hooks,
            subtle: options?.keystore?.subtle,
        })

    // Reactive surface — kms's `useKeystoreKeys` reads `state.keys` via
    // `getKeystoreStore()`, which is sourced separately in `singleton.ts`,
    // not from this extension. So the properties below are only for
    // completeness with `KeyStoreExtension`.
    return {
        get keys(): Key[] {
            return reactiveStore?.state.keys ?? []
        },
        get status(): string {
            return reactiveStore?.state.status ?? 'idle'
        },
        get algorithms(): KeyStoreCapability[] {
            return reactiveStore?.state.algorithms ?? []
        },
        key: { store: keystore },
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
