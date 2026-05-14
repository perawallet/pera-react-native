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

export const useRemoveAccountById = () => {
    const accounts = useAccountsStore(state => state.accounts)
    const { keyStore, seedIdOf, removeKeyAndChildren } = useKMS()
    const setAccounts = useAccountsStore(state => state.setAccounts)

    return async (id: string) => {
        const account = accounts.find(a => a.id === id)
        const remaining = accounts.filter(a => a.id !== id)

        if (account?.keyPairId) {
            const childKeyId = account.keyPairId
            const seedId = seedIdOf(childKeyId)

            if (seedId) {
                // Always wipe this account's own derived child — no other
                // account references it (account.id is unique).
                await keyStore.remove(childKeyId)

                // If no remaining account hangs off the same seed, sweep
                // the seed and any orphan derivation entries with it.
                const sharedSeed = remaining.some(
                    a => !!a.keyPairId && seedIdOf(a.keyPairId) === seedId,
                )
                if (!sharedSeed) {
                    await removeKeyAndChildren(seedId)
                }
            }
        }

        setAccounts([...remaining])
    }
}
