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
    type AccountChainAssetBalance,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import type { ChainId } from '@perawallet/wallet-core-chain-contract'
import type { SwapPayHolding } from '@perawallet/wallet-core-swaps'
import { useChainNetworkLabel } from '@modules/chain-ui/icon'

export type SwapSourceAccountOption = {
    account: WalletAccount
    holding: AccountChainAssetBalance
}

export type UseSwapSourceAccountListResult = {
    options: SwapSourceAccountOption[]
    networkLabelOf: (chainId: ChainId) => string
}

export const useSwapSourceAccountList = (
    holding: SwapPayHolding,
): UseSwapSourceAccountListResult => {
    const accounts = useAllAccounts()
    const networkLabelOf = useChainNetworkLabel()
    const options = useMemo(() => {
        const byId = new Map(accounts.map(account => [account.id, account]))
        return holding.holders.flatMap(holder => {
            const account = byId.get(holder.accountId)
            return account ? [{ account, holding: holder }] : []
        })
    }, [accounts, holding.holders])

    return { options, networkLabelOf }
}
