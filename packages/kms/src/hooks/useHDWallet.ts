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
import { fromSeed } from '@algorandfoundation/xhd-wallet-api'
import { KeyPair, KeyType } from '../models'
import { makeKeyPair } from '../utils'
import {
    encodeToBase64,
    decodeFromBase64,
    generateOrderedUniqueId,
    logger,
} from '@perawallet/wallet-core-shared'
import { KeyManagementError } from '../errors'
import { useKMSService } from './useKMSServices'
import { useSecureStorageService } from '@perawallet/wallet-extension-platform'
import {
    deriveAddress,
    entropyToMnemonic,
    generateHDMasterKey,
    signTransaction as hdSignTransaction,
    signData as hdSignData,
} from '../crypto/hdwallet-utils'

const ENTROPY_STORAGE_PREFIX = 'entropy-'
const SEED_STORAGE_PREFIX = 'hd-seed-'

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

        const keyId = key.id ?? ''
        const seedStorageKey = `${SEED_STORAGE_PREFIX}${keyId}`

        logger.debug(
            `[TX_SIGN] withHDSession: keyId=${keyId}, seedStorageKey=${seedStorageKey}, keystoreKeyId=${key.keystoreKeyId}`,
        )

        // Load seed and entropy from secure storage
        const [seedData, entropyData] = await Promise.all([
            secureStorage.getItem(seedStorageKey),
            secureStorage.getItem(`${ENTROPY_STORAGE_PREFIX}${keyId}`),
        ])
        if (!seedData) {
            logger.error(
                `[TX_SIGN] HD seed NOT FOUND at seedStorageKey=${seedStorageKey}`,
            )
            throw new KeyManagementError('Seed not found in secure storage')
        }
        logger.debug(
            `[TX_SIGN] HD seed loaded: seedDataLen=${seedData.length}, hasEntropy=${!!entropyData}`,
        )
        const seedBuffer = Buffer.from(
            decodeFromBase64(new TextDecoder().decode(seedData)),
        )

        // Sign locally using xhd-wallet-api directly.
        // The keystore extension's sign path has bugs: metadata property name mismatch
        // (stores keyIndex, reads index) and uses signData instead of signAlgoTransaction
        // (which rejects the "TX" prefix on encoded transactions).
        const session: KMSHDWalletSession = {
            getPublicKey: (params: HDDerivationParams) =>
                deriveAddress(seedBuffer, params),
            signTransaction: (
                params: HDDerivationParams,
                encodedTx: Uint8Array,
            ) => hdSignTransaction(seedBuffer, params, encodedTx),
            signData: (params: HDDerivationParams, data: Uint8Array) =>
                hdSignData(seedBuffer, params, data),
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
