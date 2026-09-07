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
import { algo25SignKeyId } from '../models'
import { indicesToAlgo25Seed } from '../crypto/algo25-utils'
import { useKMSService } from './useKMSServices'
import { algo25SeedToAddress, buildSeedMetadata } from '../utils'
import { zeroBytes } from '../crypto/secure-memory'
import { SeedScheme } from '../constants'

export type Algo25KeyResult = {
    seedKey: Key
    address: string
    /** Keystore id of the persisted Ed25519 signing child — what
     * `account.keyPairId` should be set to. */
    signKeyId: string
}

export const useAlgo25 = () => {
    const { keyStore } = useKMSService()

    const createAlgo25Key = async (params?: {
        id?: string
        /** Wordlist indices (`mnemonicWordsToIndices`) — never the phrase
         * itself, so no mnemonic string reaches the key path. */
        mnemonicIndices?: Uint16Array
    }): Promise<Algo25KeyResult> => {
        const seedKeyId = params?.id ?? generateOrderedUniqueId()

        let seed: Optional<Uint8Array>
        let address: string
        let committedSeed = false
        // Which step we're in, so a field report can tell a bad mnemonic from
        // an Android keystore failure — the catch below covers all three.
        let stage: 'seed' | 'seedImport' | 'signChild' = 'seed'

        try {
            seed = params?.mnemonicIndices
                ? indicesToAlgo25Seed(params.mnemonicIndices)
                : nacl.randomBytes(32)

            address = algo25SeedToAddress(seed)

            const metadata = buildSeedMetadata({ scheme: SeedScheme.Algo25 })

            // 1. Persist the 32-byte algo25 seed.
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
            stage = 'seedImport'
            await keyStore.import(seedData, 'raw')
            committedSeed = true

            // 2. Import the Ed25519 signing child derived from this exact seed.
            //
            // NOT `generate`: canary.14's `generateEd25519` ignores
            // `parentKeyId` and mints a random keypair, which silently
            // decouples the signing key from `address` and leaves the account
            // fundable but unspendable. Supplying `publicKey` makes the engine
            // verify the pair against the seed, so any drift throws here
            // rather than at submit time.
            const signKeyId = algo25SignKeyId(seedKeyId)
            const { publicKey } = nacl.sign.keyPair.fromSeed(seed)
            stage = 'signChild'
            await keyStore.import(
                {
                    id: signKeyId,
                    type: 'ed25519',
                    algorithm: 'EdDSA',
                    extractable: false,
                    keyUsages: ['sign', 'verify'],
                    privateKey: seed,
                    publicKey,
                    metadata: { parentKeyId: seedKeyId },
                },
                'raw',
            )

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
            logger.error('createAlgo25Key failed', { error: e, stage })
            throw e
        } finally {
            zeroBytes(seed)
        }
    }

    return {
        createAlgo25Key,
    }
}
