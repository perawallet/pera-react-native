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
import { generateOrderedUniqueId, logger } from '@perawallet/wallet-core-shared'
import { KeyPair, KeyType, KMSAlgo25Session } from '../models'
import {
    seedFromMnemonic,
    mnemonicFromSeed,
} from '@algorandfoundation/algokit-utils/algo25'
import { encodeAddress } from '@algorandfoundation/algokit-utils'
import { useKMSService } from './useKMSServices'
import { makeKeyPair } from '../utils'
import { clearKeyData } from '@algorandfoundation/keystore'

export const useAlgo25 = () => {
    const { saveKey, checkAccess, keyStore } = useKMSService()

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

        // Compute keypair for import into keystore
        const naclKeyPair = nacl.sign.keyPair.fromSeed(seed)
        const publicKey = encodeAddress(naclKeyPair.publicKey)

        // Import key into keystore with mnemonic in metadata for recovery
        const keystoreKeyId = await keyStore.import(
            {
                type: 'hd-derived-ed25519',
                algorithm: 'EdDSA',
                extractable: true,
                publicKey: naclKeyPair.publicKey,
                privateKey: naclKeyPair.secretKey,
                metadata: { mnemonic },
            },
            'raw',
        )

        seed.fill(0)
        naclKeyPair.secretKey.fill(0)

        const keyPair = makeKeyPair({
            id: keyId,
            keystoreKeyId,
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

        const keystoreKeyId = key.keystoreKeyId

        logger.debug(
            `[TX_SIGN] withAlgo25Session: keyId=${key.id ?? ''}, keystoreKeyId=${keystoreKeyId}`,
        )

        if (!keystoreKeyId) {
            throw new KeyManagementError('Key does not have a keystore key ID')
        }

        // Export key material from keystore for local signing
        // TODO: Route through keyStore.sign() once upstream supports standalone Ed25519 signing
        const keyData = await keyStore.export(keystoreKeyId)
        if (!keyData.privateKey) {
            throw new KeyManagementError('Key not found in keystore')
        }

        logger.debug(
            `[TX_SIGN] Algo25 key exported from keystore: hasPrivateKey=${!!keyData.privateKey}, hasPublicKey=${!!keyData.publicKey}`,
        )

        // Reconstruct nacl keypair from exported key material
        const seed = keyData.privateKey.slice(0, 32)
        const naclKeyPair = nacl.sign.keyPair.fromSeed(seed)

        const session: KMSAlgo25Session = {
            signTransaction: async (encodedTx: Uint8Array) =>
                nacl.sign.detached(encodedTx, naclKeyPair.secretKey),
            signData: async (data: Uint8Array) =>
                nacl.sign.detached(data, naclKeyPair.secretKey),
            getPublicKey: () => naclKeyPair.publicKey,
            getMnemonic: async () => {
                const mnemonic = keyData.metadata?.mnemonic as
                    | string
                    | undefined
                if (!mnemonic) {
                    throw new KeyManagementError(
                        'Mnemonic not found in keystore metadata',
                    )
                }
                return mnemonic
            },
        }

        try {
            return await handler(session)
        } finally {
            seed.fill(0)
            naclKeyPair.secretKey.fill(0)
            clearKeyData(keyData)
        }
    }

    return {
        createAlgo25Key,
        withAlgo25Session,
    }
}
