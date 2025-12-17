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
import { useHDWallet } from './useHDWallet'
import { NoHDWalletError } from '../errors'
import { useWithKey } from '@perawallet/wallet-core-kmd'

export const useTransactionSigner = () => {
    const accounts = useAccountsStore(state => state.accounts)
    const { signTransaction } = useHDWallet()
    const { executeWithKey } = useWithKey()

    const signTransactionForAddress = async (
        address: string,
        transaction: Buffer,
    ): Promise<Uint8Array> => {
        const account = accounts.find(a => a.address === address) ?? null
        const hdWalletDetails = account?.hdWalletDetails

        if (!hdWalletDetails || !account?.keyPairId) {
            return Promise.reject(new NoHDWalletError(address))
        }

        const signedTxn = await executeWithKey(
            account.keyPairId,
            'accounts',
            async privateKey => {
                let seed: Buffer
                try {
                    // Try to parse as JSON first (new format)
                    const masterKey = JSON.parse(privateKey.toString())
                    seed = Buffer.from(masterKey.seed, 'base64')
                } catch {
                    // Fall back to treating it as raw seed data (old format or tests)
                    seed = Buffer.from(privateKey)
                }
                return signTransaction(seed, hdWalletDetails, transaction)
            },
        )
        return signedTxn
    }

    return {
        signTransactionForAddress,
    }
}
