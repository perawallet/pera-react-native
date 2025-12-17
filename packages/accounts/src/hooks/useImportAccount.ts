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

import { useHDWallet } from './useHDWallet'
import { v7 as uuidv7 } from 'uuid'
import { KeyType, useKMD } from '@perawallet/wallet-core-kmd'
import { useCreateAccount } from './useCreateAccount'

export const useImportAccount = () => {
    const { generateMasterKey } = useHDWallet()
    const { saveKey } = useKMD()
    const createAccount = useCreateAccount()

    return async ({
        walletId,
        mnemonic,
    }: {
        walletId?: string
        mnemonic: string
    }) => {
        const rootWalletId = walletId ?? uuidv7()
        const masterKey = await generateMasterKey(mnemonic)
        const base64Seed = masterKey.seed.toString('base64')
        const stringifiedObj = JSON.stringify({
            seed: base64Seed,
            entropy: masterKey.entropy,
        })
        const rootKeyPair = {
            id: rootWalletId,
            publicKey: '',
            privateDataStorageKey: rootWalletId,
            createdAt: new Date(),
            type: KeyType.HDWalletRootKey,
        }
        await saveKey(rootKeyPair, Buffer.from(stringifiedObj))

        //TODO: we currently just create the 0/0 account but we really should scan the blockchain
        //and look for accounts that might match (see old app logic - we want to scan iteratively
        //until we find 5 empty keyindexes and 5 empty accounts (I think)
        const newAccount = await createAccount({
            walletId: rootWalletId,
            account: 0,
            keyIndex: 0,
        })
        return newAccount
    }
}
