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

import {
    BIP32DerivationType,
    KeyContext,
    XHDWalletAPI,
    fromSeed,
} from '@algorandfoundation/xhd-wallet-api'
import { mnemonicToSeedSync } from '@scure/bip39'
import algosdk from 'algosdk'

// Mirrors ALGORAND_HD_DERIVATION_TYPE in packages/chain-algorand: importing it
// would pull a workspace dist into a script that only needs the derivation.
// Every HD account the app derives uses Peikert, and a different type here would
// recover different addresses than the app does.
const DERIVATION_TYPE = BIP32DerivationType.Peikert

const rootOf = (mnemonic: string): Uint8Array =>
    fromSeed(Buffer.from(mnemonicToSeedSync(mnemonic)))

/** The address of HD accounts 0..accounts-1 at key index 0, as the app's import discovery finds them. */
export const deriveAddresses = async (
    mnemonic: string,
    accounts: number,
): Promise<string[]> => {
    const root = rootOf(mnemonic)
    const api = new XHDWalletAPI()
    const addresses: string[] = []
    for (let account = 0; account < accounts; account++) {
        const publicKey = await api.keyGen(
            root,
            KeyContext.Address,
            account,
            0,
            DERIVATION_TYPE,
        )
        addresses.push(algosdk.encodeAddress(publicKey))
    }
    return addresses
}

/** Signs for HD account `account` at key index 0, the way the app does. */
export const hdSigner = async (
    mnemonic: string,
    account: number,
): Promise<{ address: string; signer: algosdk.TransactionSigner }> => {
    const root = rootOf(mnemonic)
    const api = new XHDWalletAPI()
    const address = algosdk.encodeAddress(
        await api.keyGen(root, KeyContext.Address, account, 0, DERIVATION_TYPE),
    )
    const signer: algosdk.TransactionSigner = (group, indexesToSign) =>
        Promise.all(
            indexesToSign.map(async index => {
                const txn = group[index]
                const signature = await api.signAlgoTransaction(
                    root,
                    KeyContext.Address,
                    account,
                    0,
                    txn.bytesToSign(),
                    DERIVATION_TYPE,
                )
                return txn.attachSignature(address, signature)
            }),
        )
    return { address, signer }
}
