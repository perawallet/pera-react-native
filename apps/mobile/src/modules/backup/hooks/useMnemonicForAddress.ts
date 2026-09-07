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

import { useCallback, useRef } from 'react'
import {
    AccountTypes,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import {
    useKMS,
    BACKUP_ACCESS_DOMAIN,
    type ExecuteWithMnemonicHandler,
} from '@perawallet/wallet-core-kms'
import type { Optional } from '@perawallet/wallet-core-shared'

export type UseMnemonicForAddressResult = {
    /**
     * Runs `handler` with the mnemonic for `address` as a zeroable
     * `Uint16Array` of wordlist indices. The index buffer (and the raw bytes it
     * was built from) are zeroed inside the KMS session before this returns, so
     * the phrase never lives in React state — callers opt in to holding any
     * derived values (e.g. sliced word pairs) by storing them explicitly.
     */
    executeWithMnemonic: <T>(
        handler: ExecuteWithMnemonicHandler<T>,
    ) => Promise<T>
}

const DOMAIN = BACKUP_ACCESS_DOMAIN

export const useMnemonicForAddress = (
    address: Optional<string>,
    account: WalletAccount | null,
): UseMnemonicForAddressResult => {
    const kms = useKMS()
    const kmsRef = useRef(kms)
    kmsRef.current = kms
    const accountRef = useRef(account)
    accountRef.current = account
    const addressRef = useRef(address)
    addressRef.current = address

    const executeWithMnemonic = useCallback(
        async <T>(handler: ExecuteWithMnemonicHandler<T>): Promise<T> => {
            const currentAddress = addressRef.current
            const currentAccount = accountRef.current

            if (!currentAddress) {
                throw new Error('Account not found')
            }
            if (!currentAccount || currentAccount.address !== currentAddress) {
                throw new Error('Account not found')
            }

            if (
                currentAccount.type !== AccountTypes.hdWallet &&
                currentAccount.type !== AccountTypes.algo25 &&
                currentAccount.type !== AccountTypes.quantum
            ) {
                throw new Error('Account type does not support backup')
            }

            return kmsRef.current.executeWithMnemonic(
                currentAccount.keyPairId,
                DOMAIN,
                handler,
            )
        },
        [],
    )

    return { executeWithMnemonic }
}
