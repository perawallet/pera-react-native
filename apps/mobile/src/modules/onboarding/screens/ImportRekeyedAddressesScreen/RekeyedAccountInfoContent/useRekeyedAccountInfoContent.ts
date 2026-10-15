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
    type AssetWithAccountBalance,
    buildAccount,
    chainAccountOf,
    useAccountBalancesQuery,
    useAuthorityOf,
    type WalletAccount,
    type WatchAccount,
} from '@perawallet/wallet-core-accounts'

import { Decimal } from 'decimal.js'
import { LEGACY_CHAIN_ID } from '@perawallet/wallet-core-chain-contract'
import { useSelectedScope } from '@perawallet/wallet-core-chain-shared'
import type { Nullable, Optional } from '@perawallet/wallet-core-shared'
import { useIsNativeAssetId } from '@perawallet/wallet-core-assets'

type UseRekeyedAccountInfoContentParams = {
    account: WalletAccount
}

export type UseRekeyedAccountInfoContentResult = {
    address: string
    rekeyedAccountBalances: AssetWithAccountBalance[]
    /** `null` when unknown — renders as a placeholder, not 0. */
    rekeyedAccountAlgoValue: Nullable<Decimal>
    authAddress: Optional<string>
    /** `null` when unknown — renders as a placeholder, not 0. */
    authAccountAlgoValue: Nullable<Decimal>
    isPending: boolean
}

export function useRekeyedAccountInfoContent({
    account,
}: UseRekeyedAccountInfoContentParams): UseRekeyedAccountInfoContentResult {
    const scope = useSelectedScope(LEGACY_CHAIN_ID)
    const { accountBalances: rekeyedBalances, isPending: isRekeyedPending } =
        useAccountBalancesQuery([account], scope, true)
    const isNativeAssetId = useIsNativeAssetId(scope)
    const address = chainAccountOf(account, scope.chainId)?.address
    const authority = useAuthorityOf(account, useSelectedScope(LEGACY_CHAIN_ID))

    const authAccount = useMemo<Optional<WatchAccount>>(() => {
        if (!authority) return undefined
        return buildAccount({
            // Display-only synth account, keyed by its address.
            id: authority,
            custody: { kind: 'watch' },
            chainId: scope.chainId,
            chains: { [scope.chainId]: { address: authority } },
        })
    }, [authority, scope.chainId])

    const { accountBalances: authBalances, isPending: isAuthPending } =
        useAccountBalancesQuery(
            authAccount ? [authAccount] : [],
            scope,
            !!authAccount,
        )

    const rekeyedAccountData = useMemo(() => {
        const balanceData =
            address === undefined ? undefined : rekeyedBalances.get(address)
        if (!balanceData) {
            return {
                balances: [],
                algoValue: new Decimal(0),
            }
        }

        const sorted = [...balanceData.assetBalances].sort((a, b) => {
            if (isNativeAssetId(a.assetId)) return -1
            if (isNativeAssetId(b.assetId)) return 1
            return 0
        })

        return {
            balances: sorted,
            algoValue: balanceData.nativeValue,
        }
    }, [isNativeAssetId, rekeyedBalances, address])

    const authAccountAlgoValue = useMemo((): Nullable<Decimal> => {
        const authAddress =
            authAccount && chainAccountOf(authAccount, scope.chainId)?.address
        if (!authAddress) return new Decimal(0)
        const balanceData = authBalances.get(authAddress)
        return balanceData ? balanceData.nativeValue : new Decimal(0)
    }, [authBalances, authAccount, scope.chainId])

    return {
        address: address ?? '',
        rekeyedAccountBalances: rekeyedAccountData.balances,
        rekeyedAccountAlgoValue: rekeyedAccountData.algoValue,
        authAddress: authority ?? undefined,
        authAccountAlgoValue,
        isPending: isRekeyedPending || isAuthPending,
    }
}
