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
    ERROR_I18N_KEYS,
    generateOrderedUniqueId,
} from '@perawallet/wallet-core-shared'
import {
    AccessControlPermission,
    KeyPair,
    KeyType,
    KMSAlgo25Session,
} from '../models'
import {
    seedFromMnemonic,
    mnemonicFromSeed,
} from '@algorandfoundation/algokit-utils/algo25'
import { encodeAddress } from '@algorandfoundation/algokit-utils'
import { useKMSService } from './useKMSServices'
import { getSeedFromMasterKey, makeKeyPair } from '../utils'
import { KMS_DOMAIN } from '../constants'

export const useAlgo25 = () => {
    const { saveKey, executeWithKey } = useKMSService()

    const generateAlgo25Key = async (
        mnemonic?: string,
    ): Promise<Uint8Array> => {
        if (mnemonic) {
            const seed = seedFromMnemonic(mnemonic)
            return seed
        }
        throw new KeyManagementError(
            ERROR_I18N_KEYS.KEY_ACCESS_ERROR,
            new Error('New algo25 creation not implemented yet'),
        )
    }

    const algo25Sign = (seed: Uint8Array, data: Uint8Array): Uint8Array => {
        const keyPair = nacl.sign.keyPair.fromSeed(seed)
        return nacl.sign.detached(data, keyPair.secretKey)
    }

    const algo25PublicKeyFromSeed = (seed: Uint8Array): Uint8Array => {
        const keyPair = nacl.sign.keyPair.fromSeed(seed)
        return keyPair.publicKey
    }

    const createAlgo25Key = async (params: {
        id?: string
        mnemonic?: string
    }) => {
        const keyId = params.id ?? generateOrderedUniqueId()
        const secret = await generateAlgo25Key(params.mnemonic)

        const keyPair = makeKeyPair({
            id: keyId,
            publicKey: encodeAddress(algo25PublicKeyFromSeed(secret)),
            type: KeyType.Algo25Key,
            privateDataStorageKey: keyId,
            acl: [
                {
                    domains: [KMS_DOMAIN],
                    permissions: [AccessControlPermission.ReadPrivate],
                },
            ],
        })

        const savedKey = await saveKey(keyPair, {
            seed: encodeToBase64(secret),
            seedFormat: 'base64',
        })
        secret.fill(0)

        return savedKey
    }

    const withAlgo25Session = async <T>(
        key: KeyPair,
        domain: string,
        handler: (session: KMSAlgo25Session) => Promise<T>,
    ): Promise<T> => {
        return executeWithKey(key, domain, async privateData => {
            const seed = getSeedFromMasterKey(privateData)
            const session: KMSAlgo25Session = {
                signTransaction: async (encodedTx: Uint8Array) =>
                    algo25Sign(seed, encodedTx),
                signData: async (data: Uint8Array) => algo25Sign(seed, data),
                getPublicKey: () => algo25PublicKeyFromSeed(seed),
                getMnemonic: () => mnemonicFromSeed(seed),
            }

            try {
                return await handler(session)
            } finally {
                seed.fill(0)
            }
        })
    }

    return {
        createAlgo25Key,
        withAlgo25Session,
    }
}
