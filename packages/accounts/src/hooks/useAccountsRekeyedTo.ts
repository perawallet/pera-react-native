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
import { getAccountsRekeyedTo } from '../utils'
import { useAccountsStore } from '../store'
import type { WalletAccount } from '../models'

/**
 * Locally held accounts that `address` is the auth-addr of. Store-only, so it
 * misses rekeys performed outside the wallet until a rescan imports them —
 * cheap enough to call from render paths, unlike `useRekeyedAddressesQuery`,
 * which asks the indexer.
 */
export const useAccountsRekeyedTo = (
    address: string | null | undefined,
): WalletAccount[] => {
    const accounts = useAccountsStore(state => state.accounts)
    return useMemo(
        () => (address ? getAccountsRekeyedTo(address, accounts) : []),
        [address, accounts],
    )
}
