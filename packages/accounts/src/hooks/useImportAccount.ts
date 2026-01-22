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

import { v7 as uuidv7 } from 'uuid'
import { useKMS } from '@perawallet/wallet-core-kms'
import { useCreateAccount } from './useCreateAccount'
import { ImportAccountType } from '../models'
import {
    createHDWalletKeyDataFromMnemonic,
    createAlgo25WalletKeyDataFromMnemonic,
} from '../utils'

export const useImportAccount = () => {
    const { saveKey } = useKMS()
    const createAccount = useCreateAccount()

    return async ({
        walletId,
        mnemonic,
        type,
    }: {
        walletId?: string
        mnemonic: string
        type: ImportAccountType
    }) => {
        const rootWalletId = walletId ?? uuidv7()

        if (type === 'hdWallet') {
            const hdWalletKeyPair =
                await createHDWalletKeyDataFromMnemonic(mnemonic)
            const stringifiedObj = JSON.stringify({
                seed: hdWalletKeyPair.seed.toString('base64'),
                entropy: hdWalletKeyPair.entropy,
            })
            const rootKeyPair = {
                id: rootWalletId,
                publicKey: '',
                privateDataStorageKey: rootWalletId,
                createdAt: new Date(),
                type: hdWalletKeyPair.type,
            }
            await saveKey(rootKeyPair, Buffer.from(stringifiedObj))
        }

        if (type === 'algo25') {
            const algo25KeyPair =
                await createAlgo25WalletKeyDataFromMnemonic(mnemonic)
            const stringifiedObj = JSON.stringify({
                seed: algo25KeyPair.seed.toString('base64'),
                entropy: algo25KeyPair.entropy,
            })
            const rootKeyPair = {
                id: rootWalletId,
                publicKey: algo25KeyPair.publicKey!,
                privateDataStorageKey: rootWalletId,
                createdAt: new Date(),
                type: algo25KeyPair.type,
            }
            await saveKey(rootKeyPair, Buffer.from(stringifiedObj))
        }

        //TODO: we currently just create the 0/0 account but we really should scan the blockchain
        //and look for accounts that might match (see old app logic - we want to scan iteratively
        //until we find 5 empty keyindexes and 5 empty accounts (I think)
        const newAccount = await createAccount({
            walletId: rootWalletId,
            account: 0,
            keyIndex: 0,
            type,
        })
        return newAccount
    }
}
