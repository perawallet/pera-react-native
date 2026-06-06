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

import { useMemo } from 'react'
import {
    AccountTypes,
    type AssetWithAccountBalance,
    useAccountBalancesQuery,
    type WalletAccount,
    type WatchAccount,
} from '@perawallet/wallet-core-accounts'
import { ALGO_ASSET_ID } from '@perawallet/wallet-core-assets'
import { Decimal } from 'decimal.js'
import { type Optional } from '@perawallet/wallet-core-shared'

type UseRekeyedAccountInfoContentParams = {
    account: WalletAccount
}

export type UseRekeyedAccountInfoContentResult = {
    rekeyedAccountBalances: AssetWithAccountBalance[]
    rekeyedAccountAlgoValue: Decimal
    authAddress: Optional<string>
    authAccountAlgoValue: Decimal
    isPending: boolean
}

export function useRekeyedAccountInfoContent({
    account,
}: UseRekeyedAccountInfoContentParams): UseRekeyedAccountInfoContentResult {
    const { accountBalances: rekeyedBalances, isPending: isRekeyedPending } =
        useAccountBalancesQuery([account], true)

    const authAccount = useMemo<Optional<WatchAccount>>(() => {
        if (!account.rekeyAddress) return
        return {
            address: account.rekeyAddress,
            type: AccountTypes.watch,
        }
    }, [account.rekeyAddress])

    const { accountBalances: authBalances, isPending: isAuthPending } =
        useAccountBalancesQuery(authAccount ? [authAccount] : [], !!authAccount)

    const rekeyedAccountData = useMemo(() => {
        const balanceData = rekeyedBalances.get(account.address)
        if (!balanceData) {
            return {
                balances: [],
                algoValue: new Decimal(0),
            }
        }

        const sorted = [...balanceData.assetBalances].sort((a, b) => {
            if (a.assetId === ALGO_ASSET_ID) return -1
            if (b.assetId === ALGO_ASSET_ID) return 1
            return 0
        })

        return {
            balances: sorted,
            algoValue: balanceData.algoValue,
        }
    }, [rekeyedBalances, account.address])

    const authAccountAlgoValue = useMemo(() => {
        if (!authAccount) return new Decimal(0)
        const balanceData = authBalances.get(authAccount.address)
        return balanceData?.algoValue ?? new Decimal(0)
    }, [authBalances, authAccount])

    return {
        rekeyedAccountBalances: rekeyedAccountData.balances,
        rekeyedAccountAlgoValue: rekeyedAccountData.algoValue,
        authAddress: account.rekeyAddress,
        authAccountAlgoValue,
        isPending: isRekeyedPending || isAuthPending,
    }
}
