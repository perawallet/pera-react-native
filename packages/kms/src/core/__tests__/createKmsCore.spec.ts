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
import { beforeEach, describe, expect, test, vi } from 'vitest'
import nacl from 'tweetnacl'
import type { Key, KeyStoreAPI } from '@algorandfoundation/keystore-core'
import {
    InvalidKeyError,
    KeyAccessError,
    KeyManagementError,
    KeyNotFoundError,
} from '../../errors'
import { SeedScheme, SIGNING_ACCESS_DOMAIN } from '../../constants'
import { AccessControlPermission } from '../../models'
import { createKmsCore } from '../createKmsCore'
import type { KmsDerivationRequest } from '../types'

const FOREIGN_DOMAIN = 'evil.example'

const seed = (id: string, pera?: Record<string, unknown>): Key => ({
    id,
    type: 'hd-root-key',
    algorithm: 'raw',
    extractable: true,
    metadata: { scheme: SeedScheme.Bip39, ...(pera ? { pera } : {}) },
})

const child = (id: string, parentKeyId: string, publicKey?: Uint8Array) =>
    ({
        id,
        type: 'hd-derived-ed25519',
        algorithm: 'EdDSA',
        extractable: false,
        publicKey,
        metadata: { parentKeyId },
    }) as Key

const request = (
    overrides: Partial<KmsDerivationRequest> = {},
): KmsDerivationRequest => ({
    scheme: 'ed25519',
    path: "m/44'/283'/0'/0/0",
    id: 'seed-1-acc0-idx0-dt9',
    params: { mode: 'peikert', metadata: { account: 0 } },
    ...overrides,
})

let keys: Key[]
const deriveFromSeed = vi.fn()
const importKey = vi.fn()
const sign = vi.fn()
const remove = vi.fn()

const keyStore = () =>
    ({
        deriveFromSeed,
        import: importKey,
        sign,
        remove,
    }) as unknown as KeyStoreAPI

const makeCore = () => createKmsCore({ keyStore, keys: () => keys })

const expectNoKeystoreCall = () => {
    expect(deriveFromSeed).not.toHaveBeenCalled()
    expect(importKey).not.toHaveBeenCalled()
    expect(sign).not.toHaveBeenCalled()
}

const rawKey = () => new Uint8Array(32).fill(0x5a)

describe('createKmsCore', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        keys = [seed('seed-1')]
        deriveFromSeed.mockImplementation(async (_seed, _path, opts) => {
            keys.push(child(opts.id, 'seed-1', new Uint8Array(32).fill(0x11)))
            return opts.id
        })
        importKey.mockImplementation(async data => data.id)
        sign.mockImplementation(async (_id, payload: Uint8Array) =>
            payload.map(b => b ^ 0xff),
        )
    })

    describe('access denial', () => {
        test('deriveFromSeed throws KeyAccessError before the keystore is reached', async () => {
            await expect(
                makeCore().deriveFromSeed('seed-1', request(), FOREIGN_DOMAIN),
            ).rejects.toBeInstanceOf(KeyAccessError)
            expectNoKeystoreCall()
        })

        test('importRawKey under a parent throws KeyAccessError before the keystore is reached', async () => {
            await expect(
                makeCore().importRawKey(
                    rawKey(),
                    { scheme: 'ed25519', id: 'imp', parentKeyId: 'seed-1' },
                    FOREIGN_DOMAIN,
                ),
            ).rejects.toBeInstanceOf(KeyAccessError)
            expectNoKeystoreCall()
        })

        test('parentless importRawKey applies the fail-closed default ACL', async () => {
            await expect(
                makeCore().importRawKey(
                    rawKey(),
                    { scheme: 'ed25519', id: 'imp' },
                    FOREIGN_DOMAIN,
                ),
            ).rejects.toBeInstanceOf(KeyAccessError)
            expectNoKeystoreCall()
        })

        test('sign throws KeyAccessError before the keystore is reached', async () => {
            keys.push(child('c-1', 'seed-1'))
            await expect(
                makeCore().sign('c-1', new Uint8Array([1]), FOREIGN_DOMAIN),
            ).rejects.toBeInstanceOf(KeyAccessError)
            expectNoKeystoreCall()
        })

        test('an explicit seed ACL governs its children', async () => {
            keys = [
                seed('seed-1', {
                    acl: [
                        {
                            domains: ['other'],
                            permissions: [AccessControlPermission.ReadPrivate],
                        },
                    ],
                }),
                child('c-1', 'seed-1'),
            ]
            await expect(
                makeCore().sign(
                    'c-1',
                    new Uint8Array([1]),
                    SIGNING_ACCESS_DOMAIN,
                ),
            ).rejects.toBeInstanceOf(KeyAccessError)
            expect(sign).not.toHaveBeenCalled()

            await makeCore().sign('c-1', new Uint8Array([1]), 'other')
            expect(sign).toHaveBeenCalledTimes(1)
        })
    })

    describe('unsupported scheme', () => {
        test.each(['secp256k1', 'falcon-1024'])(
            'deriveFromSeed rejects %s before the keystore is reached',
            async scheme => {
                await expect(
                    makeCore().deriveFromSeed(
                        'seed-1',
                        request({ scheme }),
                        SIGNING_ACCESS_DOMAIN,
                    ),
                ).rejects.toBeInstanceOf(KeyManagementError)
                expectNoKeystoreCall()
            },
        )

        test.each(['secp256k1', 'falcon-1024'])(
            'importRawKey rejects %s and still zeroes the input',
            async scheme => {
                const bytes = rawKey()
                await expect(
                    makeCore().importRawKey(
                        bytes,
                        { scheme, id: 'imp' },
                        SIGNING_ACCESS_DOMAIN,
                    ),
                ).rejects.toBeInstanceOf(KeyManagementError)
                expectNoKeystoreCall()
                expect(bytes.every(b => b === 0)).toBe(true)
            },
        )
    })

    describe('key ids', () => {
        test('passes the caller id and params to the keystore verbatim', async () => {
            await makeCore().deriveChild(
                'seed-1',
                request(),
                SIGNING_ACCESS_DOMAIN,
            )
            expect(deriveFromSeed).toHaveBeenCalledWith(
                'seed-1',
                "m/44'/283'/0'/0/0",
                {
                    mode: 'peikert',
                    metadata: { account: 0 },
                    algorithm: 'EdDSA',
                    id: 'seed-1-acc0-idx0-dt9',
                },
            )
        })

        test('a repeated derive reuses the same id', async () => {
            const core = makeCore()
            await core.deriveChild('seed-1', request(), SIGNING_ACCESS_DOMAIN)
            await core.deriveChild('seed-1', request(), SIGNING_ACCESS_DOMAIN)
            expect(deriveFromSeed.mock.calls[0][2].id).toBe(
                deriveFromSeed.mock.calls[1][2].id,
            )
        })

        test('params cannot override the id or algorithm', async () => {
            await makeCore().deriveChild(
                'seed-1',
                request({ params: { id: 'hijack', algorithm: 'raw' } }),
                SIGNING_ACCESS_DOMAIN,
            )
            expect(deriveFromSeed.mock.calls[0][2]).toMatchObject({
                id: 'seed-1-acc0-idx0-dt9',
                algorithm: 'EdDSA',
            })
        })

        test('an empty id throws before the keystore is reached', async () => {
            await expect(
                makeCore().deriveFromSeed(
                    'seed-1',
                    request({ id: '' }),
                    SIGNING_ACCESS_DOMAIN,
                ),
            ).rejects.toBeInstanceOf(KeyManagementError)
            const bytes = rawKey()
            await expect(
                makeCore().importRawKey(
                    bytes,
                    { scheme: 'ed25519', id: '' },
                    SIGNING_ACCESS_DOMAIN,
                ),
            ).rejects.toBeInstanceOf(KeyManagementError)
            expectNoKeystoreCall()
        })

        test('importRawKey imports under the caller id', async () => {
            await makeCore().importRawKey(
                rawKey(),
                {
                    scheme: 'ed25519',
                    id: 'seed-1-ed25519',
                    parentKeyId: 'seed-1',
                },
                SIGNING_ACCESS_DOMAIN,
            )
            expect(importKey.mock.calls[0][0]).toMatchObject({
                id: 'seed-1-ed25519',
                type: 'ed25519',
                extractable: false,
                metadata: { parentKeyId: 'seed-1' },
            })
            expect(importKey.mock.calls[0][1]).toBe('raw')
        })
    })

    describe('derivation result', () => {
        test('deriveFromSeed returns the keystore id and the stored public key', async () => {
            const result = await makeCore().deriveFromSeed(
                'seed-1',
                request(),
                SIGNING_ACCESS_DOMAIN,
            )
            expect(result).toEqual({
                keyPairId: 'seed-1-acc0-idx0-dt9',
                publicKey: new Uint8Array(32).fill(0x11),
            })
        })

        test('deriveFromSeed throws when the derived key has no public key', async () => {
            deriveFromSeed.mockResolvedValueOnce('no-pub')
            await expect(
                makeCore().deriveFromSeed(
                    'seed-1',
                    request(),
                    SIGNING_ACCESS_DOMAIN,
                ),
            ).rejects.toBeInstanceOf(KeyManagementError)
        })

        test('deriveChild does not need a public key', async () => {
            deriveFromSeed.mockResolvedValueOnce('no-pub')
            await expect(
                makeCore().deriveChild(
                    'seed-1',
                    request(),
                    SIGNING_ACCESS_DOMAIN,
                ),
            ).resolves.toBe('no-pub')
        })

        test('a backend without deriveFromSeed throws KeyManagementError', async () => {
            const core = createKmsCore({
                keyStore: () => ({ sign }) as unknown as KeyStoreAPI,
                keys: () => keys,
            })
            await expect(
                core.deriveChild('seed-1', request(), SIGNING_ACCESS_DOMAIN),
            ).rejects.toBeInstanceOf(KeyManagementError)
        })
    })

    describe('importRawKey zeroisation', () => {
        test('zeroes the input and returns the matching public key on success', async () => {
            const bytes = rawKey()
            const expected = nacl.sign.keyPair.fromSeed(rawKey()).publicKey
            const result = await makeCore().importRawKey(
                bytes,
                { scheme: 'ed25519', id: 'imp', parentKeyId: 'seed-1' },
                SIGNING_ACCESS_DOMAIN,
            )
            expect(result).toEqual({ keyPairId: 'imp', publicKey: expected })
            expect(bytes.every(b => b === 0)).toBe(true)
        })

        test('zeroes the input when the keystore import rejects', async () => {
            importKey.mockRejectedValueOnce(new Error('import boom'))
            const bytes = rawKey()
            await expect(
                makeCore().importRawKey(
                    bytes,
                    { scheme: 'ed25519', id: 'imp' },
                    SIGNING_ACCESS_DOMAIN,
                ),
            ).rejects.toThrow('import boom')
            expect(bytes.every(b => b === 0)).toBe(true)
        })

        test('zeroes the input on access denial', async () => {
            const bytes = rawKey()
            await expect(
                makeCore().importRawKey(
                    bytes,
                    { scheme: 'ed25519', id: 'imp' },
                    FOREIGN_DOMAIN,
                ),
            ).rejects.toBeInstanceOf(KeyAccessError)
            expect(bytes.every(b => b === 0)).toBe(true)
        })

        test('zeroes a wrong-length input and throws InvalidKeyError', async () => {
            const bytes = new Uint8Array(64).fill(0x5a)
            await expect(
                makeCore().importRawKey(
                    bytes,
                    { scheme: 'ed25519', id: 'imp' },
                    SIGNING_ACCESS_DOMAIN,
                ),
            ).rejects.toBeInstanceOf(InvalidKeyError)
            expect(bytes.every(b => b === 0)).toBe(true)
            expectNoKeystoreCall()
        })
    })

    describe('signing', () => {
        beforeEach(() => {
            keys.push(child('c-1', 'seed-1'))
        })

        test('sign passes the payload through untouched and returns the signature as is', async () => {
            const payload = new Uint8Array([1, 2, 3])
            const signature = await makeCore().sign(
                'c-1',
                payload,
                SIGNING_ACCESS_DOMAIN,
            )
            expect(sign).toHaveBeenCalledWith('c-1', payload)
            expect(signature).toEqual(new Uint8Array([0xfe, 0xfd, 0xfc]))
        })

        test('signEach checks access once and signs once per payload', async () => {
            const checkAccess = vi.fn()
            const core = createKmsCore({
                keyStore,
                keys: () => keys,
                checkAccess,
            })
            const out = await core.signEach(
                'c-1',
                [new Uint8Array([1]), new Uint8Array([2])],
                SIGNING_ACCESS_DOMAIN,
            )
            expect(checkAccess).toHaveBeenCalledTimes(1)
            expect(checkAccess.mock.calls[0][0].id).toBe('seed-1')
            expect(sign).toHaveBeenCalledTimes(2)
            expect(out).toHaveLength(2)
        })
    })

    describe('seed resolution', () => {
        test('an expired seed throws KeyNotFoundError without removing it', async () => {
            keys = [
                seed('seed-1', { expiresAt: '2000-01-01T00:00:00.000Z' }),
                child('c-1', 'seed-1'),
            ]
            await expect(
                makeCore().sign(
                    'c-1',
                    new Uint8Array([1]),
                    SIGNING_ACCESS_DOMAIN,
                ),
            ).rejects.toBeInstanceOf(KeyNotFoundError)
            expect(remove).not.toHaveBeenCalled()
            expect(sign).not.toHaveBeenCalled()
        })

        test('an unknown key throws KeyNotFoundError', async () => {
            await expect(
                makeCore().sign(
                    'missing',
                    new Uint8Array([1]),
                    SIGNING_ACCESS_DOMAIN,
                ),
            ).rejects.toBeInstanceOf(KeyNotFoundError)
        })

        test('a parentless raw import cannot be signed with', async () => {
            keys.push({
                id: 'imp',
                type: 'ed25519',
                algorithm: 'EdDSA',
                extractable: false,
                metadata: {},
            })
            await expect(
                makeCore().sign(
                    'imp',
                    new Uint8Array([1]),
                    SIGNING_ACCESS_DOMAIN,
                ),
            ).rejects.toBeInstanceOf(InvalidKeyError)
        })

        test('an injected resolver replaces the snapshot lookup', async () => {
            const resolveSeedKey = vi.fn(() => seed('seed-1'))
            const core = createKmsCore({
                keyStore,
                keys: () => [],
                resolveSeedKey,
            })
            await core.sign('c-1', new Uint8Array([1]), SIGNING_ACCESS_DOMAIN)
            expect(resolveSeedKey).toHaveBeenCalledWith('c-1')
        })
    })
})
