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
    AssetWithAccountBalance,
    useAccountBalancesQuery,
    WatchAccount,
    type DiscoveredRekeyedAccount,
} from '@perawallet/wallet-core-accounts'
import { ALGO_ASSET_ID } from '@perawallet/wallet-core-assets'
import { Decimal } from 'decimal.js'

type UseRekeyedAccountInfoBottomSheetParams = {
    discovered: DiscoveredRekeyedAccount
    isVisible: boolean
}

export type UseRekeyedAccountInfoBottomSheetResult = {
    rekeyedAccountBalances: AssetWithAccountBalance[]
    rekeyedAccountAlgoValue: Decimal
    authAddress: string | undefined
    authAccountAlgoValue: Decimal
    isPending: boolean
}

export function useRekeyedAccountInfoBottomSheet({
    discovered,
    isVisible,
}: UseRekeyedAccountInfoBottomSheetParams): UseRekeyedAccountInfoBottomSheetResult {
    const { account, authAddress: discoveredAuthAddress } = discovered
    const { accountBalances: rekeyedBalances, isPending: isRekeyedPending } =
        useAccountBalancesQuery([account], isVisible)

    const authAccount = useMemo<WatchAccount | undefined>(() => {
        if (!discoveredAuthAddress) return undefined
        return {
            address: discoveredAuthAddress,
            type: AccountTypes.watch,
        }
    }, [discoveredAuthAddress])

    const { accountBalances: authBalances, isPending: isAuthPending } =
        useAccountBalancesQuery(
            authAccount ? [authAccount] : [],
            isVisible && !!authAccount,
        )

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
        authAddress: discoveredAuthAddress,
        authAccountAlgoValue,
        isPending: isRekeyedPending || isAuthPending,
    }
}
