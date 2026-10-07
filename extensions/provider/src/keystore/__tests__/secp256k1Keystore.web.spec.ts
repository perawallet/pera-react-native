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

// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { IDBFactory } from 'fake-indexeddb'
import { Store } from '@tanstack/store'
import Hook from 'before-after-hook'
import * as secp from '@noble/secp256k1'
import { keccak_256 } from '@noble/hashes/sha3.js'
import { bytesToHex, hexToBytes } from '@noble/hashes/utils.js'
import { mnemonicToEntropy } from '@scure/bip39'
import { wordlist } from '@scure/bip39/wordlists/english.js'
import {
    InvalidKeyDataError,
    InvalidKeyFormatError,
    type KeyStoreState,
} from '@algorandfoundation/keystore-core'

// The default shims dynamically import WASM Falcon, XHD and dp256; none of
// that is under test, and the secp256k1 shim is appended after them.
vi.mock('@algorandfoundation/keystore-core', async importOriginal => {
    const original =
        await importOriginal<
            typeof import('@algorandfoundation/keystore-core')
        >()
    return { ...original, createDefaultShims: () => [] }
})

import { createPeraKeystore } from '../createKeystore.web'
import { setEngineKeySource } from '../engineKeySource'
import { SECP256K1_ALGORITHM } from '../shims/secp256k1'

const SESSION_KEY = Uint8Array.from({ length: 32 }, (_, i) => i + 1)
const TEST_WORDS = 'test test test test test test test test test test test junk'
// The key and address MetaMask (and Hardhat) list first for TEST_WORDS.
const FIRST_PRIVATE_KEY = hexToBytes(
    'ac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80',
)
const FIRST_ADDRESS = 'f39fd6e51aad88f6f4ce6ab8827279cfffb92266'
const FIRST_PATH = "m/44'/60'/0'/0/0"

const freshKeystore = async () => {
    const store = new Store<KeyStoreState>({ keys: [], status: 'idle' })
    const keystore = createPeraKeystore({
        store,
        hooks: new Hook.Collection(),
    })
    await keystore.ready
    return { keystore, store }
}

const storeEntropy = (
    keystore: Awaited<ReturnType<typeof freshKeystore>>['keystore'],
) =>
    keystore.secrets!.put(mnemonicToEntropy(TEST_WORDS, wordlist), {
        id: 'seed-1-entropy',
        metadata: { parentKeyId: 'seed-1', entropyKey: true },
    })

const deriveFirst = (
    keystore: Awaited<ReturnType<typeof freshKeystore>>['keystore'],
    path = FIRST_PATH,
) =>
    keystore.deriveFromSeed!('seed-1-entropy', path, {
        algorithm: SECP256K1_ALGORITHM,
        curve: 'secp256k1',
        id: 'eth-0',
        metadata: { parentKeyId: 'seed-1' },
    })

const addressOf = (publicKey: Uint8Array): string =>
    bytesToHex(keccak_256(publicKey.slice(1)).slice(-20))

const verifies = (
    signature: Uint8Array,
    digest: Uint8Array,
    publicKey: Uint8Array,
): boolean =>
    signature.length === 65 &&
    secp.verify(signature.slice(0, 64), digest, publicKey, { prehash: false })

describe('secp256k1 through the patched engine and the provider shim', () => {
    beforeEach(() => {
        globalThis.indexedDB = new IDBFactory()
        setEngineKeySource(async () => Uint8Array.from(SESSION_KEY))
    })

    it("derives MetaMask's first key from the HD wallet's entropy and seals it under the seed", async () => {
        const { keystore, store } = await freshKeystore()
        await storeEntropy(keystore)

        const id = await deriveFirst(keystore)

        const entry = store.state.keys.find(k => k.id === id)!
        expect(entry.type).toBe('hd-derived-secp256k1')
        expect(entry.extractable).toBe(false)
        expect(entry.metadata?.parentKeyId).toBe('seed-1')
        expect(entry.metadata?.path).toBe(FIRST_PATH)
        expect(addressOf(entry.publicKey!)).toBe(FIRST_ADDRESS)
    })

    it('signs a 32-byte digest as r‖s‖yParity that verifies, and never exports the key', async () => {
        const { keystore, store } = await freshKeystore()
        await storeEntropy(keystore)
        const id = await deriveFirst(keystore)
        const publicKey = store.state.keys.find(k => k.id === id)!.publicKey!
        const digest = new Uint8Array(32).fill(0xab)

        const signature = await keystore.sign(id, digest)

        expect(verifies(signature, digest, publicKey)).toBe(true)
        expect([0, 1]).toContain(signature[64])
        expect(await keystore.export(id)).not.toHaveProperty('privateKey')
    })

    it('refuses a digest that is not 32 bytes', async () => {
        const { keystore } = await freshKeystore()
        await storeEntropy(keystore)
        const id = await deriveFirst(keystore)

        await expect(
            keystore.sign(id, new Uint8Array(33)),
        ).rejects.toBeInstanceOf(InvalidKeyDataError)
    })

    it('seals an imported raw key as non-extractable and signs with it', async () => {
        const { keystore, store } = await freshKeystore()
        const digest = new Uint8Array(32).fill(0x42)

        const id = await keystore.import(
            {
                id: 'imported-1',
                type: 'secp256k1',
                algorithm: SECP256K1_ALGORITHM,
                extractable: true,
                keyUsages: ['sign', 'verify'],
                privateKey: Uint8Array.from(FIRST_PRIVATE_KEY),
            },
            'raw',
        )

        const entry = store.state.keys.find(k => k.id === id)!
        expect(entry.extractable).toBe(false)
        expect(addressOf(entry.publicKey!)).toBe(FIRST_ADDRESS)
        expect(
            verifies(await keystore.sign(id, digest), digest, entry.publicKey!),
        ).toBe(true)
        expect(await keystore.export(id)).not.toHaveProperty('privateKey')
    })

    it('refuses to import an out-of-range key', async () => {
        const { keystore } = await freshKeystore()

        await expect(
            keystore.import(
                {
                    id: 'imported-1',
                    type: 'secp256k1',
                    algorithm: SECP256K1_ALGORITHM,
                    extractable: false,
                    keyUsages: ['sign', 'verify'],
                    privateKey: new Uint8Array(32),
                },
                'raw',
            ),
        ).rejects.toBeInstanceOf(InvalidKeyDataError)
    })

    it('refuses a parent that does not hold BIP39 entropy', async () => {
        const { keystore } = await freshKeystore()
        await keystore.import(
            {
                id: 'algo25-seed',
                type: 'seed',
                algorithm: 'raw',
                extractable: false,
                keyUsages: ['deriveKey', 'deriveBits'],
                privateKey: new Uint8Array(32).fill(1),
                metadata: { scheme: 'algo25' },
            },
            'raw',
        )

        await expect(
            keystore.deriveFromSeed!('algo25-seed', FIRST_PATH, {
                algorithm: SECP256K1_ALGORITHM,
                curve: 'secp256k1',
                id: 'eth-0',
            }),
        ).rejects.toBeInstanceOf(InvalidKeyDataError)
    })

    it('refuses a malformed path', async () => {
        const { keystore } = await freshKeystore()
        await storeEntropy(keystore)

        await expect(deriveFirst(keystore, "m/44'//0")).rejects.toBeInstanceOf(
            InvalidKeyFormatError,
        )
    })
})
