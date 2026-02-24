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
import { AccessControlPermission, KeyPair, KeyType } from '../models'
import {
    getEntropyFromMasterKey,
    getSeedFromMasterKey,
    makeKeyPair,
} from '../utils'
import {
    encodeToBase64,
    generateOrderedUniqueId,
} from '@perawallet/wallet-core-shared'
import { InvalidKeyError } from '../errors'
import { useKMSService } from './useKMSServices'
import {
    deriveAddress,
    entropyToMnemonic,
    generateHDMasterKey,
    signData,
    signTransaction,
} from '../crypto/hdwallet-utils'
import { KMS_DOMAIN } from '../constants'

export const useHDWallet = () => {
    const { saveKey, executeWithKey } = useKMSService()

    const createHDWalletKey = async (params?: {
        id?: string
        mnemonic?: string
    }) => {
        const keyId = params?.id ?? generateOrderedUniqueId()
        const masterKey = await generateHDMasterKey(params?.mnemonic)

        const keyPair = makeKeyPair({
            id: keyId,
            type: KeyType.HDWalletRootKey,
            privateDataStorageKey: keyId,
            acl: [
                {
                    domains: [KMS_DOMAIN],
                    permissions: [AccessControlPermission.ReadPrivate],
                },
            ],
        })

        const savedKey = await saveKey(keyPair, {
            seed: encodeToBase64(masterKey.seed),
            seedFormat: 'base64',
            entropy: masterKey.entropy,
        })
        masterKey.seed.fill(0)

        return savedKey
    }

    const withHDSession = async <T>(
        key: KeyPair,
        domain: string,
        handler: (session: KMSHDWalletSession) => Promise<T>,
    ): Promise<T> => {
        return executeWithKey(key, domain, async privateData => {
            const seedBuffer = Buffer.from(getSeedFromMasterKey(privateData))
            const session: KMSHDWalletSession = {
                signTransaction: (
                    params: HDDerivationParams,
                    encodedTx: Uint8Array,
                ) => signTransaction(seedBuffer, params, encodedTx),
                signData: (params: HDDerivationParams, data: Uint8Array) =>
                    signData(seedBuffer, params, data),
                getPublicKey: (params: HDDerivationParams) =>
                    deriveAddress(seedBuffer, params),
                getMnemonic: () => {
                    const entropy = getEntropyFromMasterKey(privateData)
                    if (!entropy) {
                        throw new InvalidKeyError(key.id ?? 'unknown')
                    }
                    return entropyToMnemonic(Buffer.from(entropy))
                },
            }

            try {
                return await handler(session)
            } finally {
                seedBuffer.fill(0)
            }
        })
    }

    return {
        createHDWalletKey,
        withHDSession,
    }
}
