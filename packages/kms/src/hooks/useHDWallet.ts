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

import type { HDDerivationParams, KMSHDWalletSession } from '../models/session'
import type { DeriveOptions } from '@algorandfoundation/keystore'
import {
    BIP32DerivationType,
    fromSeed,
} from '@algorandfoundation/xhd-wallet-api'
import { KeyPair, KeyType } from '../models'
import { makeKeyPair } from '../utils'
import {
    encodeToBase64,
    decodeFromBase64,
    generateOrderedUniqueId,
} from '@perawallet/wallet-core-shared'
import { KeyManagementError } from '../errors'
import { useKMSService } from './useKMSServices'
import { useSecureStorageService } from '@perawallet/wallet-extension-platform'
import {
    deriveAddress,
    entropyToMnemonic,
    generateHDMasterKey,
} from '../crypto/hdwallet-utils'

const ENTROPY_STORAGE_PREFIX = 'entropy-'
const SEED_STORAGE_PREFIX = 'hd-seed-'

const toDerivationPath = (params: HDDerivationParams): string =>
    `m/44'/283'/${params.account}'/0/${params.keyIndex}`

const toDerivationMode = (derivationType: number): DeriveOptions['mode'] => {
    switch (derivationType) {
        case BIP32DerivationType.Peikert:
            return 'peikert'
        case BIP32DerivationType.Khovratovich:
            return 'standard'
        default:
            return 'peikert'
    }
}

export const useHDWallet = () => {
    const { saveKey, checkAccess, keyStore } = useKMSService()
    const secureStorage = useSecureStorageService()

    const createHDWalletKey = async (params?: {
        id?: string
        mnemonic?: string
    }) => {
        const keyId = params?.id ?? generateOrderedUniqueId()
        const masterKey = await generateHDMasterKey(params?.mnemonic)

        // Convert BIP39 seed to XHD root key (96 bytes: kL || kR || chainCode)
        const rootKey = fromSeed(masterKey.seed)

        // Import root key bytes into keystore extension
        const keystoreKeyId = await keyStore.importSeed!(rootKey, {
            name: keyId,
        })

        // Store seed in secure storage for local public key derivation
        await secureStorage.setItem(
            `${SEED_STORAGE_PREFIX}${keyId}`,
            new TextEncoder().encode(encodeToBase64(masterKey.seed)),
        )

        // Store entropy separately for mnemonic recovery
        await secureStorage.setItem(
            `${ENTROPY_STORAGE_PREFIX}${keyId}`,
            new TextEncoder().encode(
                encodeToBase64(Buffer.from(masterKey.entropy, 'hex')),
            ),
        )

        masterKey.seed.fill(0)
        rootKey.fill(0)

        const keyPair = makeKeyPair({
            id: keyId,
            keystoreKeyId,
            type: KeyType.HDWalletRootKey,
        })

        return await saveKey(keyPair)
    }

    const withHDSession = async <T>(
        key: KeyPair,
        domain: string,
        handler: (session: KMSHDWalletSession) => Promise<T>,
    ): Promise<T> => {
        checkAccess(key, domain)

        if (!key.keystoreKeyId) {
            throw new KeyManagementError(
                'Key has no keystore ID. Migration may be required.',
            )
        }

        const keystoreKeyId = key.keystoreKeyId
        const keyId = key.id ?? ''

        // Load seed and entropy from secure storage
        const [seedData, entropyData] = await Promise.all([
            secureStorage.getItem(`${SEED_STORAGE_PREFIX}${keyId}`),
            secureStorage.getItem(`${ENTROPY_STORAGE_PREFIX}${keyId}`),
        ])
        if (!seedData) {
            throw new KeyManagementError('Seed not found in secure storage')
        }
        const seedBuffer = Buffer.from(
            decodeFromBase64(new TextDecoder().decode(seedData)),
        )

        // Cache derived key IDs within this session to avoid re-deriving
        const derivedKeyCache = new Map<string, string>()

        const getDerivedKeyId = async (
            params: HDDerivationParams,
        ): Promise<string> => {
            const path = toDerivationPath(params)
            const cacheKey = `${path}:${params.derivationType}`

            const cached = derivedKeyCache.get(cacheKey)
            if (cached) {
                return cached
            }

            const derivedKeyId = await keyStore.deriveFromSeed!(
                keystoreKeyId,
                path,
                {
                    algorithm: 'EdDSA',
                    mode: toDerivationMode(params.derivationType),
                },
            )

            derivedKeyCache.set(cacheKey, derivedKeyId)
            return derivedKeyId
        }

        const session: KMSHDWalletSession = {
            getPublicKey: (params: HDDerivationParams) =>
                deriveAddress(seedBuffer, params),
            signTransaction: async (
                params: HDDerivationParams,
                encodedTx: Uint8Array,
            ) => {
                const derivedKeyId = await getDerivedKeyId(params)
                return keyStore.sign(derivedKeyId, encodedTx)
            },
            signData: async (params: HDDerivationParams, data: Uint8Array) => {
                const derivedKeyId = await getDerivedKeyId(params)
                return keyStore.sign(derivedKeyId, data)
            },
            getMnemonic: () => {
                if (!entropyData) {
                    throw new KeyManagementError('Entropy not found')
                }
                const entropy = Buffer.from(
                    decodeFromBase64(new TextDecoder().decode(entropyData)),
                )
                return entropyToMnemonic(entropy)
            },
        }

        try {
            return await handler(session)
        } finally {
            seedBuffer.fill(0)
        }
    }

    return {
        createHDWalletKey,
        withHDSession,
    }
}
