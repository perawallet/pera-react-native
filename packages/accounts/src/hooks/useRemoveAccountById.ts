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
        const remaining = accounts.filter(a => a.id !== id)

        if (account && account.keyPairId) {
            if (account.type === 'algo25' || account.type === 'hdWallet') {
                await deleteKey(account.keyPairId)
            }

            // The seed/entropy keystore entries are siblings of the root key,
            // named deterministically as `${keyPairId}-seed` and
            // `${keyPairId}-entropy` (see useAlgo25.ts / useHDWallet.ts). Remove
            // them only when no other account still references the same root.
            if (isAlgo25Account(account)) {
                const sharedRoot = remaining.some(
                    a =>
                        isAlgo25Account(a) && a.keyPairId === account.keyPairId,
                )
                if (!sharedRoot) {
                    await keyStore.remove(`${account.keyPairId}-seed`)
                }
            }

            if (isHDWalletAccount(account)) {
                const sharedRoot = remaining.some(
                    a =>
                        isHDWalletAccount(a) &&
                        a.keyPairId === account.keyPairId,
                )
                if (!sharedRoot) {
                    await keyStore.remove(`${account.keyPairId}-entropy`)
                }
            }
        }

        setAccounts([...remaining])
    }
}
