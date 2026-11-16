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
    addressOn,
    chainAccountOf,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import { CHAIN_IDS } from '@perawallet/wallet-core-chain-contract'
import { useSelectedScopes } from '@perawallet/wallet-core-chain-shared'
import { isSwapChain } from '../chain-adapter'
import type { SwapAccountAddressWithId } from '../models'

/** Each account's address on each swap chain it lives on, at that chain's selected network. */
export const useSwapAccountsAddresses = (
    accounts: readonly WalletAccount[],
): SwapAccountAddressWithId[] => {
    const chainIds = useMemo(
        () =>
            CHAIN_IDS.filter(
                chainId =>
                    isSwapChain(chainId) &&
                    accounts.some(
                        account => !!chainAccountOf(account, chainId),
                    ),
            ),
        [accounts],
    )
    const scopes = useSelectedScopes(chainIds)

    return useMemo(
        () =>
            accounts.flatMap(account =>
                scopes.flatMap(scope => {
                    const address = addressOn(account, scope)
                    return address
                        ? [{ scope, address, accountId: account.id }]
                        : []
                }),
            ),
        [accounts, scopes],
    )
}
