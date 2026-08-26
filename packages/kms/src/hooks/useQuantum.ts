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

import nacl from 'tweetnacl'
import type { Key, Seed } from '@algorandfoundation/keystore-core'
import {
    generateOrderedUniqueId,
    logger,
    type Optional,
} from '@perawallet/wallet-core-shared'
import { seedFromMnemonic } from 'algosdk'
import {
    deriveQuantumAddress,
    derivePQKeygenSeed,
} from '@perawallet/wallet-core-blockchain'
import {
    FALCON_CHILD_KEY_TYPE,
    PQ_DERIVATION_CANONICAL,
    PQ_DERIVATION_LEGACY,
    type PQDerivation,
    quantumSignKeyId,
} from '../models'
import { useKMSService } from './useKMSServices'
import { buildSeedMetadata } from '../utils'
import { zeroBytes } from '../crypto/secure-memory'
import { KeyManagementError } from '../errors'
import { QUANTUM_SEED_LENGTH, SeedScheme } from '../constants'

export type QuantumKeyResult = {
    seedKey: Key
    address: string
    /** Keystore id of the persisted quantum signing child — what
     * `account.keyPairId` should be set to. */
    signKeyId: string
}

export const useQuantum = () => {
    const { keyStore } = useKMSService()

    const createQuantumKey = async (params?: {
        id?: string
        mnemonic?: string
        derivation?: PQDerivation
        /** Attach a second child to an existing seed record instead of importing a new one. */
        reuseSeedId?: string
    }): Promise<QuantumKeyResult> => {
        if (params?.id && params?.reuseSeedId) {
            throw new KeyManagementError(
                '`id` and `reuseSeedId` are mutually exclusive',
            )
        }

        const derivation = params?.derivation ?? PQ_DERIVATION_CANONICAL
        const seedKeyId =
            params?.reuseSeedId ?? params?.id ?? generateOrderedUniqueId()

        let seed: Optional<Uint8Array>
        let keygenSeed: Optional<Uint8Array>
        let committedSeed = false

        try {
            // The quantum mnemonic format IS algo25 (24 data words + 1 checksum
            // word over 32 bytes of entropy), so the mnemonic→seed path is
            // algosdk's — no quantum-specific mnemonic code exists.
            seed = params?.mnemonic
                ? seedFromMnemonic(params.mnemonic)
                : nacl.randomBytes(QUANTUM_SEED_LENGTH)

            const metadata = buildSeedMetadata({ scheme: SeedScheme.Quantum })

            // 1. Persist the 32-byte quantum seed — unless we're attaching a
            // second child to a seed record this call didn't create. Two
            // children can share one seed record; importing it twice would
            // persist the same entropy at rest twice, which is worse than
            // the derivation bug this exists to fix.
            if (!params?.reuseSeedId) {
                // Pass the seed buffer directly (no defensive copy) so the
                // `finally`'s `zeroBytes(seed)` wipes the same Uint8Array
                const seedData: Omit<Seed, 'id'> & { id: string } = {
                    id: seedKeyId,
                    type: 'seed',
                    algorithm: 'raw',
                    extractable: true,
                    keyUsages: ['deriveKey', 'deriveBits'],
                    privateKey: seed,
                    metadata,
                }
                await keyStore.import(seedData, 'raw')
                committedSeed = true
            }

            // 2. Mint the signing child — the keystore derives the Falcon
            // keypair from `keygenSeed` and seals the private half itself.
            //
            // The keystore feeds `params.seed` straight to Falcon keygen, so
            // the canonical hop has to happen here: go-algorand's algokey
            // derives SHA512_256("PQK" || scheme || entropy) first, and Falcon
            // seeded with the bare entropy yields a different account than the
            // same mnemonic produces in every other Algorand tool. Legacy IS
            // the raw entropy — it must reach Falcon unmodified, or it mints
            // an address no existing legacy account was ever created at.
            keygenSeed =
                derivation === PQ_DERIVATION_LEGACY
                    ? seed
                    : derivePQKeygenSeed(seed)

            // `id` and `parentKeyId` ride the untyped `params` bag: the engine
            // resolves the entry id as `params.id ?? randomUUID()`, and strips
            // seed/entropy/passphrase/salt before mirroring `params` into the
            // entry's plaintext metadata — so the seed does not leak there.
            // `pqDerivation` is not stripped, so it lands in the child's
            // metadata: the repair path fails closed on an unmarked child.
            const signKeyId = await keyStore.generate({
                type: FALCON_CHILD_KEY_TYPE,
                algorithm: 'Falcon-1024',
                extractable: false,
                keyUsages: ['sign', 'verify'],
                params: {
                    seed: keygenSeed,
                    parentKeyId: seedKeyId,
                    id: quantumSignKeyId(seedKeyId, derivation),
                    pqDerivation: derivation,
                },
            })

            // The address must come from the key the keystore actually minted,
            // not from a second in-JS derivation that could drift from it.
            const { publicKey } = await keyStore.export(signKeyId)
            if (!publicKey) {
                throw new KeyManagementError(
                    `Quantum child ${signKeyId} has no public key to derive an address from`,
                )
            }
            const address = deriveQuantumAddress(publicKey)

            return {
                seedKey: {
                    id: seedKeyId,
                    type: 'seed',
                    algorithm: 'raw',
                    extractable: true,
                    metadata,
                },
                address,
                signKeyId,
            }
        } catch (e) {
            // delete the seed if it was created
            if (committedSeed) {
                try {
                    await keyStore.remove(seedKeyId)
                } catch {
                    /* swallow */
                }
            }
            logger.error('createQuantumKey failed', { error: e })
            throw e
        } finally {
            zeroBytes(seed)
            zeroBytes(keygenSeed)
        }
    }

    return {
        createQuantumKey,
    }
}
