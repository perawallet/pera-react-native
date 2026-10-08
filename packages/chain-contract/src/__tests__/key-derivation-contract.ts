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

import { describe, expect, it } from 'vitest'
import type { AddressCodec } from '../contracts/address-codec'
import type {
    ChainKeyStore,
    DerivedKey,
    KeyDerivation,
    KeyDerivationRequest,
    KeyImportRequest,
} from '../contracts/key-derivation'
import type { DeriveOpts } from '../models/domain'

export interface KeyDerivationContractFixtures {
    /** The chain's own codec: every derived or imported address must pass it. */
    codec: AddressCodec
    deriveOpts: DeriveOpts
    /** Options naming a scheme this chain cannot derive; omit when it derives every scheme. */
    unsupportedOpts?: DeriveOpts
    rawKey: Uint8Array
    /** Maps the suite's 32 fake key bytes to a public key this chain's codec accepts; identity when omitted. */
    shapePublicKey?: (fakeKeyBytes: Uint8Array) => Uint8Array
}

type FakeKeyStore = ChainKeyStore & {
    derivations: KeyDerivationRequest[]
    imports: KeyImportRequest[]
}

// Not real crypto: the suite pins how a chain drives the port (paths, ids,
// determinism), so any stable bytes-from-text mapping will do.
const fakeKeyBytes = (text: string): Uint8Array => {
    let hash = 0x81_1c_9d_c5
    for (let i = 0; i < text.length; i++) {
        hash = Math.imul(hash ^ text.charCodeAt(i), 0x01_00_01_93)
    }
    const bytes = new Uint8Array(32)
    for (let i = 0; i < bytes.length; i++) {
        hash = Math.imul(hash ^ i, 0x01_00_01_93)
        bytes[i] = hash >>> 24
    }
    return bytes
}

export const createFakeChainKeyStore = (
    shapePublicKey: (fakeKeyBytes: Uint8Array) => Uint8Array = bytes => bytes,
): FakeKeyStore => {
    const derivations: KeyDerivationRequest[] = []
    const imports: KeyImportRequest[] = []
    return {
        derivations,
        imports,
        deriveFromSeed: async (seedRef, request): Promise<DerivedKey> => {
            derivations.push(request)
            return {
                keyPairId: request.id,
                publicKey: shapePublicKey(
                    fakeKeyBytes(`${seedRef}|${request.scheme}|${request.path}`),
                ),
            }
        },
        importRawKey: async (bytes, request): Promise<DerivedKey> => {
            imports.push(request)
            return {
                keyPairId: request.id,
                publicKey: shapePublicKey(
                    fakeKeyBytes(`${request.scheme}|${bytes.join(',')}`),
                ),
            }
        },
        sign: async () => new Uint8Array(64),
    }
}

const SEED = 'seed-1'

/** Every chain package runs this against its own derivation. */
export const keyDerivationContractTests = (
    makeDerivation: () => KeyDerivation,
    fixtures: KeyDerivationContractFixtures,
): void => {
    const { codec, deriveOpts, shapePublicKey } = fixtures
    const createKeyStore = () => createFakeChainKeyStore(shapePublicKey)

    describe(`KeyDerivation contract: ${makeDerivation().chainId}`, () => {
        it('derives the same key id and a valid address for the same coordinates', async () => {
            const derivation = makeDerivation()
            const kms = createKeyStore()

            const first = await derivation.deriveAccount(
                kms,
                SEED,
                0,
                0,
                deriveOpts,
            )
            const second = await derivation.deriveAccount(
                kms,
                SEED,
                0,
                0,
                deriveOpts,
            )

            expect(second).toEqual(first)
            expect(kms.derivations[1]).toEqual(kms.derivations[0])
            expect(codec.isValid(first.address, deriveOpts.networkId)).toBe(
                true,
            )
        })

        it('derives distinct keys for distinct coordinates', async () => {
            const derivation = makeDerivation()
            const kms = createKeyStore()

            const derived = await Promise.all(
                [
                    [0, 0],
                    [0, 1],
                    [1, 0],
                ].map(([account, keyIndex]) =>
                    derivation.deriveAccount(
                        kms,
                        SEED,
                        account,
                        keyIndex,
                        deriveOpts,
                    ),
                ),
            )

            expect(new Set(derived.map(d => d.keyPairId)).size).toBe(3)
            expect(new Set(derived.map(d => d.address)).size).toBe(3)
        })

        it('encodes the derived public key with its own codec', async () => {
            const derived = await makeDerivation().deriveAccount(
                createKeyStore(),
                SEED,
                0,
                0,
                deriveOpts,
            )

            expect(
                codec.areEqual(
                    derived.address,
                    codec.fromPublicKey(derived.publicKey, deriveOpts),
                ),
            ).toBe(true)
        })

        it('imports a raw key to the same valid address every time', async () => {
            const derivation = makeDerivation()

            const first = await derivation.importRawKey(
                createKeyStore(),
                fixtures.rawKey,
                deriveOpts,
            )
            const second = await derivation.importRawKey(
                createKeyStore(),
                fixtures.rawKey,
                deriveOpts,
            )

            expect(first.keyPairId).not.toBe('')
            expect(second).toEqual(first)
            expect(codec.isValid(first.address, deriveOpts.networkId)).toBe(
                true,
            )
        })

        it.runIf(fixtures.unsupportedOpts !== undefined)(
            'rejects a scheme it cannot derive',
            async () => {
                await expect(
                    makeDerivation().deriveAccount(
                        createKeyStore(),
                        SEED,
                        0,
                        0,
                        fixtures.unsupportedOpts!,
                    ),
                ).rejects.toThrow()
            },
        )

        it('discovers nothing when no address has activity', async () => {
            await expect(
                makeDerivation().discover(
                    createKeyStore(),
                    SEED,
                    async () => false,
                    deriveOpts,
                ),
            ).resolves.toEqual([])
        })

        it('discovers only active addresses, each re-derivable from its coordinates', async () => {
            const derivation = makeDerivation()
            const active = await derivation.deriveAccount(
                createKeyStore(),
                SEED,
                0,
                0,
                deriveOpts,
            )

            const found = await derivation.discover(
                createKeyStore(),
                SEED,
                async address => codec.areEqual(address, active.address),
                deriveOpts,
            )

            expect(found.map(c => c.address)).toEqual([active.address])
            const [candidate] = found
            const rederived = await derivation.deriveAccount(
                createKeyStore(),
                SEED,
                candidate.account,
                candidate.keyIndex,
                deriveOpts,
            )
            expect(rederived.address).toBe(candidate.address)
            expect(rederived.keyPairId).toBe(candidate.keyPairId)
        })
    })
}
