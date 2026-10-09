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
    useAccountStateQuery,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import { useNativeAsset } from '@perawallet/wallet-core-assets'
import { LEGACY_CHAIN_ID } from '@perawallet/wallet-core-chain-contract'
import { useSelectedScope } from '@perawallet/wallet-core-chain-shared'
import {
    displayUnitsToBaseUnitsBigInt,
    toBigInt,
    type Nullable,
    type Optional,
} from '@perawallet/wallet-core-shared'

/** Amounts are base units of the chain's native asset. */
export type SenderBalances = {
    amount: bigint
    minBalance: bigint
    hasOptedInAssets: boolean
}

/** The sender's synced balances; `undefined` until loaded. */
export const useSenderBalances = (
    account: Nullable<WalletAccount> | undefined,
): Optional<SenderBalances> => {
    const scope = useSelectedScope(LEGACY_CHAIN_ID)
    const { decimals: nativeDecimals } = useNativeAsset()
    const { data } = useAccountStateQuery(account, scope)

    return useMemo(() => {
        if (!data) return undefined
        const chainState =
            data.chainState.family === 'algorand' ? data.chainState : undefined
        return {
            amount: displayUnitsToBaseUnitsBigInt(
                data.nativeBalance,
                nativeDecimals,
            ),
            minBalance: chainState ? toBigInt(chainState.minBalance) : 0n,
            hasOptedInAssets: (chainState?.totalAssetsOptedIn ?? 0) > 0,
        }
    }, [data, nativeDecimals])
}
