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

import nacl from 'tweetnacl'
import type { Key, Seed } from '@algorandfoundation/keystore'
import {
    generateOrderedUniqueId,
    logger,
    type Optional,
} from '@perawallet/wallet-core-shared'
import { seedFromMnemonic } from 'algosdk'
import { quantumSignKeyId } from '../models'
import { useKMSService } from './useKMSServices'
import { buildSeedMetadata } from '../utils'
import {
    deriveFalconAddressMock,
    deriveFalconKeypairMock,
} from '../crypto/falcon-utils'
import { commitFalconChildKey } from '../storage/falcon-child'
import { zeroBytes } from '../crypto/secure-memory'
import { FALCON_SEED_LENGTH, SeedScheme } from '../constants'

export type FalconKeyResult = {
    seedKey: Key
    address: string
    /** Keystore id of the persisted falcon signing child — what
     * `account.keyPairId` should be set to. */
    signKeyId: string
}

export const useFalcon = () => {
    const { keyStore } = useKMSService()

    const createFalconKey = async (params?: {
        id?: string
        mnemonic?: string
    }): Promise<FalconKeyResult> => {
        const seedKeyId = params?.id ?? generateOrderedUniqueId()

        let seed: Optional<Uint8Array>
        let committedSeed = false

        try {
            // Falcon's mnemonic format IS algo25 (24 data words + 1 checksum
            // word over 32 bytes of entropy), so the mnemonic→seed path is
            // algosdk's — no falcon-specific mnemonic code exists.
            seed = params?.mnemonic
                ? seedFromMnemonic(params.mnemonic)
                : nacl.randomBytes(FALCON_SEED_LENGTH)

            const { publicKey } = deriveFalconKeypairMock(seed)
            const address = deriveFalconAddressMock(publicKey)

            const metadata = buildSeedMetadata({ scheme: SeedScheme.Falcon })

            // 1. Persist the 32-byte falcon seed.
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

            // 2. Persist the falcon signing child (public material only —
            // signing always re-derives from the parent seed).
            const signKeyId = quantumSignKeyId(seedKeyId)
            await commitFalconChildKey({
                id: signKeyId,
                parentKeyId: seedKeyId,
                publicKey,
            })

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
            logger.error('createFalconKey failed', { error: e })
            throw e
        } finally {
            zeroBytes(seed)
        }
    }

    return {
        createFalconKey,
    }
}
