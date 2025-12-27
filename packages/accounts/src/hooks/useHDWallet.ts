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

import type { HDWalletDetails } from '../models'
import {
    BIP32DerivationTypes,
    type BIP32DerivationType,
    Encodings,
    fromSeed,
    KeyContexts,
    XHDWalletAPI,
} from '@perawallet/wallet-core-xhdwallet'
import * as bip39 from 'bip39'
import messageSchema from '../schema/message-schema.json'
import { WORDLIST } from '../wordlist'

const api = new XHDWalletAPI()

const HD_PURPOSE = 44
const HD_COIN_TYPE = 283
const HD_MNEMONIC_LENGTH = 256

const createPath = (account: number, keyIndex: number) => {
    //m / purpose (bip44) / coin type (algorand) / account / change / address index
    return [HD_PURPOSE, HD_COIN_TYPE, account, 0, keyIndex]
}

const generateMasterKey = async (mnemonic?: string) => {
    const storableMnemonic =
        mnemonic ??
        bip39.generateMnemonic(HD_MNEMONIC_LENGTH, undefined, WORDLIST)
    const seed = await bip39.mnemonicToSeed(storableMnemonic)
    const entropy = await bip39.mnemonicToEntropy(storableMnemonic)
    return {
        seed,
        entropy,
    }
}

const entropyToMnemonic = (entropy: Buffer) => {
    return bip39.entropyToMnemonic(entropy)
}

const deriveKey = async ({
    seed,
    account = 0,
    keyIndex = 0,
    derivationType = BIP32DerivationTypes.Peikert,
}: {
    seed: Buffer
    account?: number
    keyIndex?: number
    derivationType?: BIP32DerivationType
}) => {
    const rootKey = fromSeed(seed)
    const path = createPath(account, keyIndex)
    const key = await api.deriveKey(rootKey, path, true, derivationType)
    const address = await api.keyGen(
        rootKey,
        KeyContexts.Address,
        account,
        keyIndex,
        derivationType,
    )
    return {
        address: address,
        privateKey: key,
    }
}

const signTransaction = (
    seed: Buffer,
    hdWalletDetails: HDWalletDetails,
    transaction: Buffer,
) => {
    const rootKey = fromSeed(seed)
    return api.signAlgoTransaction(
        rootKey,
        KeyContexts.Address,
        hdWalletDetails.account,
        hdWalletDetails.keyIndex,
        transaction,
        BIP32DerivationTypes.Peikert,
    )
}

const signData = (
    seed: Buffer,
    hdWalletDetails: HDWalletDetails,
    data: Buffer,
) => {
    const rootKey = fromSeed(seed)
    const metadata = {
        encoding: Encodings.BASE64,
        schema: messageSchema,
    }
    return api.signData(
        rootKey,
        KeyContexts.Address,
        hdWalletDetails.account,
        hdWalletDetails.keyIndex,
        data,
        metadata,
        BIP32DerivationTypes.Peikert,
    )
}

export const useHDWallet = () => ({
    generateMasterKey,
    entropyToMnemonic,
    deriveKey,
    signTransaction,
    signData,
})
