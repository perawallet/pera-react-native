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
import type { WalletAccount } from '@perawallet/wallet-core-accounts'
import type { ChainId } from '@perawallet/wallet-core-chain-contract'
import { useSwapSigningAccounts } from './useSwapScope'
import { useSwapSourceChainsResolver } from './useSwapSourceChainsResolver'

export type UseSwapSourceChainsByAccountResult = {
    /** The accounts that can sign a swap. */
    accounts: WalletAccount[]
    /** Each of `accounts`' ids to the chains it can pay a swap from. */
    sourceChainsByAccount: ReadonlyMap<string, ChainId[]>
    /** Every chain some account can pay from, once each. */
    sourceChainIds: ChainId[]
}

export const useSwapSourceChainsByAccount =
    (): UseSwapSourceChainsByAccountResult => {
        const accounts = useSwapSigningAccounts()
        const sourceChainsOf = useSwapSourceChainsResolver()
        return useMemo(() => {
            const sourceChainsByAccount = new Map(
                accounts.map(account => [account.id, sourceChainsOf(account)]),
            )
            return {
                accounts,
                sourceChainsByAccount,
                sourceChainIds: [
                    ...new Set([...sourceChainsByAccount.values()].flat()),
                ],
            }
        }, [accounts, sourceChainsOf])
    }
