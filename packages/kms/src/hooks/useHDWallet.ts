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

import {
    BIP32DerivationType,
    Encoding,
    fromSeed,
    KeyContext,
    XHDWalletAPI,
} from '@algorandfoundation/xhd-wallet-api'
import * as bip39 from 'bip39'
import messageSchema from '../crypto/message-schema.json'
import { WORDLIST } from '../crypto/wordlist'
import type { HDDerivationParams, KMSHDWalletSession } from '../models/session'
import { v7 as uuid } from 'uuid'
import { KeyPair, KeyType } from '../models'
import { getEntropyFromMasterKey, getSeedFromMasterKey } from '../utils'
import { encodeToBase64 } from '@perawallet/wallet-core-shared'
import { InvalidKeyError } from '../errors'
import { useKMSService } from './useKMSServices'

const api = new XHDWalletAPI()

const HD_MNEMONIC_LENGTH = 256

const entropyToMnemonic = (entropy: Buffer) => {
    return bip39.entropyToMnemonic(entropy)
}

const deriveAddress = async (
    seed: Buffer,
    params: HDDerivationParams,
): Promise<Uint8Array> => {
    const rootKey = fromSeed(seed)
    return api.keyGen(
        rootKey,
        KeyContext.Address,
        params.account,
        params.keyIndex,
        params.derivationType as BIP32DerivationType,
    )
}

const signTransaction = async (
    seed: Buffer,
    params: HDDerivationParams,
    encodedTx: Uint8Array,
): Promise<Uint8Array> => {
    const rootKey = fromSeed(seed)
    return api.signAlgoTransaction(
        rootKey,
        KeyContext.Address,
        params.account,
        params.keyIndex,
        encodedTx,
        params.derivationType as BIP32DerivationType,
    )
}

const signData = async (
    seed: Buffer,
    params: HDDerivationParams,
    data: Uint8Array,
): Promise<Uint8Array> => {
    const rootKey = fromSeed(seed)
    const metadata = {
        encoding: Encoding.BASE64,
        schema: messageSchema,
    }
    return api.signData(
        rootKey,
        KeyContext.Address,
        params.account,
        params.keyIndex,
        data,
        metadata,
        params.derivationType as BIP32DerivationType,
    )
}

const generateHDMasterKey = async (mnemonic?: string) => {
    const storableMnemonic =
        mnemonic ??
        bip39.generateMnemonic(HD_MNEMONIC_LENGTH, undefined, WORDLIST)
    const seed = await bip39.mnemonicToSeed(storableMnemonic)
    const entropy = await bip39.mnemonicToEntropy(storableMnemonic)
    return {
        seed,
        entropy,
        mnemonic: storableMnemonic,
    }
}

export const useHDWallet = () => {
    const { saveKey, executeWithKey } = useKMSService()

    const createHDWalletKey = async (params?: {
        id?: string
        mnemonic?: string
    }) => {
        const keyId = params?.id ?? uuid()
        const masterKey = await generateHDMasterKey(params?.mnemonic)

        const keyPair: KeyPair = {
            id: keyId,
            publicKey: '',
            privateDataStorageKey: '',
            createdAt: new Date(),
            type: KeyType.HDWalletRootKey,
        }

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
            return await handler(session)
        })
    }

    return {
        createHDWalletKey,
        withHDSession,
    }
}
