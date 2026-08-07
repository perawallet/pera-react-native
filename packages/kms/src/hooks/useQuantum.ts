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
import { deriveQuantumAddress } from '@perawallet/wallet-core-blockchain'
import { FALCON_CHILD_KEY_TYPE, quantumSignKeyId } from '../models'
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
    }): Promise<QuantumKeyResult> => {
        const seedKeyId = params?.id ?? generateOrderedUniqueId()

        let seed: Optional<Uint8Array>
        let committedSeed = false

        try {
            // The quantum mnemonic format IS algo25 (24 data words + 1 checksum
            // word over 32 bytes of entropy), so the mnemonic→seed path is
            // algosdk's — no quantum-specific mnemonic code exists.
            seed = params?.mnemonic
                ? seedFromMnemonic(params.mnemonic)
                : nacl.randomBytes(QUANTUM_SEED_LENGTH)

            const metadata = buildSeedMetadata({ scheme: SeedScheme.Quantum })

            // 1. Persist the 32-byte quantum seed.
            //
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

            // 2. Mint the signing child — the keystore derives the Falcon
            // keypair from `seed` and seals the private half itself.
            //
            // `id` and `parentKeyId` ride the untyped `params` bag: the engine
            // resolves the entry id as `params.id ?? randomUUID()`, and strips
            // seed/entropy/passphrase/salt before mirroring `params` into the
            // entry's plaintext metadata — so the seed does not leak there.
            const signKeyId = await keyStore.generate({
                type: FALCON_CHILD_KEY_TYPE,
                algorithm: 'Falcon-1024',
                extractable: false,
                keyUsages: ['sign', 'verify'],
                params: {
                    seed,
                    parentKeyId: seedKeyId,
                    id: quantumSignKeyId(seedKeyId),
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
        }
    }

    return {
        createQuantumKey,
    }
}
