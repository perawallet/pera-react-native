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

import type { SecureStorageService } from '@perawallet/wallet-core-platform-integration'
import {
    AppError,
    truncateAlgorandAddress,
} from '@perawallet/wallet-core-shared'
import type { WalletAccount } from './models'
import { KeyAccessError } from './errors'

export const getAccountDisplayName = (account: WalletAccount | null) => {
    if (!account) return 'No Account'
    if (account.name) return account.name
    if (!account.address) return 'No Address Found'
    return truncateAlgorandAddress(account.address)
}

export const withKey = async <T>(
    keyPath: string,
    secureStorage: SecureStorageService,
    handler: (key: Buffer | null) => Promise<T>,
) => {
    const mnemonic = await secureStorage.getItem(keyPath)

    try {
        const result = await handler(mnemonic)

        return result
    } catch (error) {
        if (error instanceof AppError) {
            throw error
        }
        throw new KeyAccessError(error as Error)
    } finally {
        //blank out the memory again after using
        if (mnemonic && Buffer.isBuffer(mnemonic)) {
            mnemonic.fill(0)
        }
    }
}
