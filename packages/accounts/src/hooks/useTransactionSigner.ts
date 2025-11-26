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

import { useSecureStorageService } from '@perawallet/wallet-core-platform-integration'
import { useAccountsStore } from '../store'
import { useHDWallet } from './useHDWallet'
import { withKey } from '../utils'

export const useTransactionSigner = () => {
    const accounts = useAccountsStore(state => state.accounts)
    const { signTransaction } = useHDWallet()
    const secureStorage = useSecureStorageService()

    const signTransactionForAddress = async (
        address: string,
        transaction: Buffer,
    ): Promise<Uint8Array> => {
        const account = accounts.find(a => a.address === address) ?? null
        const hdWalletDetails = account?.hdWalletDetails

        if (!hdWalletDetails) {
            return Promise.reject(`No HD wallet found for ${address}`)
        }

        const storageKey = `rootkey-${hdWalletDetails.walletId}`
        return withKey(storageKey, secureStorage, async keyData => {
            if (!keyData) {
                return Promise.reject(`No signing keys found for ${address}`)
            }

            let seed: Buffer
            try {
                // Try to parse as JSON first (new format)
                const masterKey = JSON.parse(keyData.toString())
                seed = Buffer.from(masterKey.seed, 'base64')
            } catch {
                // Fall back to treating it as raw seed data (old format or tests)
                seed = keyData
            }
            return signTransaction(seed, hdWalletDetails, transaction)
        })
    }

    return {
        signTransactionForAddress,
    }
}
