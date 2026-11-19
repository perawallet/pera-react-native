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

import { useMemo } from 'react'
import {
    useAllAccounts,
    useCapabilityChainResolver,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'

/** Accounts holding any chain with gift cards on, not just their own chain; only these can pay Bidali. */
export const useGiftCardAccounts = (): WalletAccount[] => {
    const accounts = useAllAccounts()
    const giftCardChainOf = useCapabilityChainResolver('giftCards')

    return useMemo(
        () =>
            accounts.filter(account => giftCardChainOf(account) !== undefined),
        [accounts, giftCardChainOf],
    )
}
