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

import { useAccountsStore } from '../store'
import { useKMS } from '@perawallet/wallet-core-kms'
import { isAlgo25Account, isHDWalletAccount } from '../utils'

export const useRemoveAccountById = () => {
    const accounts = useAccountsStore(state => state.accounts)
    const { deleteKey, keyStore } = useKMS()
    const setAccounts = useAccountsStore(state => state.setAccounts)

    return async (id: string) => {
        const account = accounts.find(a => a.id === id)
        if (account && account.keyPairId) {
            if (account.type === 'algo25' || account.type === 'hdWallet') {
                await deleteKey(account.keyPairId)
            }

            if (isAlgo25Account(account) && account.seedKeyId) {
                await keyStore.remove(account.seedKeyId)
            }

            if (isHDWalletAccount(account) && account.entropyKeyId) {
                await keyStore.remove(account.entropyKeyId)
            }
        }

        //TODO we need to delete the wallet key if there are no other accounts with that wallet id

        const remaining = accounts.filter(a => a.id !== id)
        setAccounts([...remaining])
    }
}
