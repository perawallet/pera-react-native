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
import { KeyManagementError } from '../errors'
import {
    encodeToBase64,
    decodeFromBase64,
    generateOrderedUniqueId,
    logger,
} from '@perawallet/wallet-core-shared'
import { KeyPair, KeyType, KMSAlgo25Session } from '../models'
import {
    seedFromMnemonic,
    mnemonicFromSeed,
} from '@algorandfoundation/algokit-utils/algo25'
import { encodeAddress } from '@algorandfoundation/algokit-utils'
import { useKMSService } from './useKMSServices'
import { makeKeyPair } from '../utils'
import { useSecureStorageService } from '@perawallet/wallet-extension-platform'

const MNEMONIC_STORAGE_PREFIX = 'mnemonic-'
const SEED_STORAGE_PREFIX = 'algo25-seed-'

export const useAlgo25 = () => {
    const { saveKey, checkAccess } = useKMSService()
    const secureStorage = useSecureStorageService()

    const createAlgo25Key = async (params?: {
        id?: string
        mnemonic?: string
    }) => {
        const keyId = params?.id ?? generateOrderedUniqueId()

        let mnemonic: string
        let seed: Uint8Array

        try {
            if (params?.mnemonic) {
                mnemonic = params.mnemonic
                seed = seedFromMnemonic(mnemonic)
            } else {
                seed = nacl.randomBytes(32)
                mnemonic = mnemonicFromSeed(seed)
            }
        } catch (e) {
            logger.error(
                `createAlgo25Key failed: ${e instanceof Error ? e.message : String(e)}`,
            )
            throw e
        }

        // Compute public key locally
        const naclKeyPair = nacl.sign.keyPair.fromSeed(seed)
        const publicKey = encodeAddress(naclKeyPair.publicKey)

        // Store seed in secure storage for signing
        await secureStorage.setItem(
            `${SEED_STORAGE_PREFIX}${keyId}`,
            new TextEncoder().encode(encodeToBase64(seed)),
        )

        // Store mnemonic separately for recovery
        await secureStorage.setItem(
            `${MNEMONIC_STORAGE_PREFIX}${keyId}`,
            new TextEncoder().encode(mnemonic),
        )

        seed.fill(0)
        naclKeyPair.secretKey.fill(0)

        const keyPair = makeKeyPair({
            id: keyId,
            publicKey,
            type: KeyType.Algo25Key,
        })

        return await saveKey(keyPair)
    }

    const withAlgo25Session = async <T>(
        key: KeyPair,
        domain: string,
        handler: (session: KMSAlgo25Session) => Promise<T>,
    ): Promise<T> => {
        checkAccess(key, domain)

        const keyId = key.id ?? ''

        // Load seed from secure storage
        const seedData = await secureStorage.getItem(
            `${SEED_STORAGE_PREFIX}${keyId}`,
        )
        if (!seedData) {
            throw new KeyManagementError(
                'Seed not found in secure storage',
            )
        }
        const seed = decodeFromBase64(new TextDecoder().decode(seedData))
        const naclKeyPair = nacl.sign.keyPair.fromSeed(seed)

        const session: KMSAlgo25Session = {
            signTransaction: async (encodedTx: Uint8Array) =>
                nacl.sign.detached(encodedTx, naclKeyPair.secretKey),
            signData: async (data: Uint8Array) =>
                nacl.sign.detached(data, naclKeyPair.secretKey),
            getPublicKey: () => naclKeyPair.publicKey,
            getMnemonic: () => {
                throw new KeyManagementError(
                    `Mnemonic must be read async from secure storage key: ${MNEMONIC_STORAGE_PREFIX}${keyId}`,
                )
            },
        }

        try {
            return await handler(session)
        } finally {
            seed.fill(0)
            naclKeyPair.secretKey.fill(0)
        }
    }

    return {
        createAlgo25Key,
        withAlgo25Session,
    }
}
