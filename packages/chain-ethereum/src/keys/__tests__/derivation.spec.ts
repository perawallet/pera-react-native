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

import { describe, expect, it, vi } from 'vitest'
import { bytesToHex, hexToBytes } from 'viem'
import type {
    ChainKeyStore,
    DeriveOpts,
    KeyDerivationRequest,
    KeyImportRequest,
} from '@perawallet/wallet-core-chain-contract'
import {
    createFakeChainKeyStore,
    keyDerivationContractTests,
} from '@perawallet/wallet-core-chain-contract/testing'
import { ethereumAddressCodec } from '../../addresses'
import { ethereumKeyDerivation } from '../derivation'

const MAINNET: DeriveOpts = { scheme: 'secp256k1', networkId: 'mainnet' }
const SEPOLIA: DeriveOpts = { scheme: 'secp256k1', networkId: 'sepolia' }
const ED25519: DeriveOpts = { scheme: 'ed25519', networkId: 'mainnet' }

// The codec only accepts a 65-byte uncompressed key; any 64 bytes after the
// 0x04 prefix hash to a valid address.
const toUncompressedKey = (bytes: Uint8Array) =>
    Uint8Array.of(0x04, ...bytes, ...bytes)

keyDerivationContractTests(() => ethereumKeyDerivation, {
    codec: ethereumAddressCodec,
    deriveOpts: MAINNET,
    unsupportedOpts: ED25519,
    rawKey: new Uint8Array(32).fill(3),
    shapePublicKey: toUncompressedKey,
})

// Public keys and addresses MetaMask lists first and second for
// `test test test test test test test test test test test junk`.
const FIRST_PATH = "m/44'/60'/0'/0/0"
const SECOND_PATH = "m/44'/60'/0'/0/1"
const FIRST_ADDRESS = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266'
const SECOND_ADDRESS = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8'
const PUBLIC_KEYS: Record<string, Uint8Array> = {
    [FIRST_PATH]: hexToBytes(
        '0x048318535b54105d4a7aae60c08fc45f9687181b4fdfc625bd1a753fa7397fed753547f11ca8696646f2f3acb08e31016afac23e630c5d11f59f61fef57b0d2aa5',
    ),
    [SECOND_PATH]: hexToBytes(
        '0x04ba5734d8f7091719471e7f7ed6b9df170dc70cc661ca05e688601ad984f068b0d67351e5f06073092499336ab0839ef8a521afd334e53807205fa2f08eec74f4',
    ),
}
// The private key of the second address.
const SECOND_PRIVATE_KEY =
    '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d'
const KMS_ENTRY_ID = 'kms-entry-1'

type Recorded<T> = { request: T; domain: string; bytes?: Uint8Array }

// Stands in for the KMS with known-answer vectors: the real derivation of the
// mnemonic happens inside the keystore, never in this package.
const createVectorKeyStore = () => {
    const derivations: Recorded<KeyDerivationRequest>[] = []
    const imports: Recorded<KeyImportRequest>[] = []
    const keyStore: ChainKeyStore = {
        deriveFromSeed: async (_seedRef, request, domain) => {
            derivations.push({ request, domain })
            const publicKey = PUBLIC_KEYS[request.path]
            if (!publicKey) throw new Error(`no vector for ${request.path}`)
            return { keyPairId: request.id, publicKey }
        },
        importRawKey: async (bytes, request, domain) => {
            imports.push({ request, domain, bytes })
            if (bytesToHex(bytes) !== SECOND_PRIVATE_KEY) {
                throw new Error('Invalid key')
            }
            return {
                keyPairId: KMS_ENTRY_ID,
                publicKey: PUBLIC_KEYS[SECOND_PATH],
            }
        },
        sign: async () => new Uint8Array(65),
    }
    return { keyStore, derivations, imports }
}

describe('ethereumKeyDerivation', () => {
    describe('deriveAccount', () => {
        it("derives MetaMask's first address at account 0, index 0", async () => {
            const { keyStore, derivations } = createVectorKeyStore()

            const derived = await ethereumKeyDerivation.deriveAccount(
                keyStore,
                'seed-1',
                0,
                0,
                MAINNET,
            )

            expect(derived).toEqual({
                keyPairId: 'seed-1-eth-acc0-idx0',
                publicKey: PUBLIC_KEYS[FIRST_PATH],
                address: FIRST_ADDRESS,
            })
            expect(derivations).toEqual([
                {
                    request: {
                        scheme: 'secp256k1',
                        path: FIRST_PATH,
                        id: 'seed-1-eth-acc0-idx0',
                    },
                    domain: 'pera.accounts',
                },
            ])
        })

        it("derives MetaMask's second address at account 0, index 1", async () => {
            const { keyStore } = createVectorKeyStore()

            const derived = await ethereumKeyDerivation.deriveAccount(
                keyStore,
                'seed-1',
                0,
                1,
                MAINNET,
            )

            expect(derived.address).toBe(SECOND_ADDRESS)
            expect(derived.keyPairId).toBe('seed-1-eth-acc0-idx1')
        })

        it('derives a later account along its own hardened account segment', async () => {
            const kms = createFakeChainKeyStore(toUncompressedKey)

            await ethereumKeyDerivation.deriveAccount(
                kms,
                'seed-1',
                1,
                0,
                MAINNET,
            )

            expect(kms.derivations[0]).toEqual({
                scheme: 'secp256k1',
                path: "m/44'/60'/1'/0/0",
                id: 'seed-1-eth-acc1-idx0',
            })
        })

        it('derives the same address on every network', async () => {
            const { keyStore } = createVectorKeyStore()

            const derived = await ethereumKeyDerivation.deriveAccount(
                keyStore,
                'seed-1',
                0,
                0,
                SEPOLIA,
            )

            expect(derived.address).toBe(FIRST_ADDRESS)
        })

        it('rejects a non-secp256k1 scheme without reaching the KMS', async () => {
            const { keyStore, derivations } = createVectorKeyStore()

            await expect(
                ethereumKeyDerivation.deriveAccount(
                    keyStore,
                    'seed-1',
                    0,
                    0,
                    ED25519,
                ),
            ).rejects.toThrow('Ethereum keys are secp256k1 only, got ed25519')
            expect(derivations).toEqual([])
        })
    })

    describe('importRawKey', () => {
        it('returns the known address under the id the KMS assigned', async () => {
            const { keyStore, imports } = createVectorKeyStore()
            const privateKey = hexToBytes(SECOND_PRIVATE_KEY)

            const imported = await ethereumKeyDerivation.importRawKey(
                keyStore,
                privateKey,
                MAINNET,
            )

            expect(imported).toEqual({
                keyPairId: KMS_ENTRY_ID,
                address: SECOND_ADDRESS,
            })
            expect(imports).toHaveLength(1)
            expect(imports[0].request).toEqual({
                scheme: 'secp256k1',
                id: 'ethereum-raw-977470c9b1b2dc828bf7d091fc62f74a',
            })
            expect(imports[0].domain).toBe('pera.accounts')
            expect(imports[0].bytes).toBe(privateKey)
        })

        it('propagates the KMS rejecting the key', async () => {
            const { keyStore } = createVectorKeyStore()

            await expect(
                ethereumKeyDerivation.importRawKey(
                    keyStore,
                    new Uint8Array(32).fill(9),
                    MAINNET,
                ),
            ).rejects.toThrow('Invalid key')
        })

        it('rejects a non-secp256k1 scheme without reaching the KMS', async () => {
            const { keyStore, imports } = createVectorKeyStore()

            await expect(
                ethereumKeyDerivation.importRawKey(
                    keyStore,
                    hexToBytes(SECOND_PRIVATE_KEY),
                    ED25519,
                ),
            ).rejects.toThrow('Ethereum keys are secp256k1 only, got ed25519')
            expect(imports).toEqual([])
        })
    })

    describe('discover', () => {
        it('returns the first address when it has activity', async () => {
            const { keyStore } = createVectorKeyStore()
            const probe = vi.fn(async () => true)

            const found = await ethereumKeyDerivation.discover(
                keyStore,
                'seed-1',
                probe,
                MAINNET,
            )

            expect(found).toEqual([
                {
                    account: 0,
                    keyIndex: 0,
                    address: FIRST_ADDRESS,
                    keyPairId: 'seed-1-eth-acc0-idx0',
                },
            ])
            expect(probe).toHaveBeenCalledTimes(1)
            expect(probe).toHaveBeenCalledWith(FIRST_ADDRESS)
        })

        it('returns nothing when the first address has no activity', async () => {
            const { keyStore } = createVectorKeyStore()

            await expect(
                ethereumKeyDerivation.discover(
                    keyStore,
                    'seed-1',
                    async () => false,
                    MAINNET,
                ),
            ).resolves.toEqual([])
        })
    })
})
