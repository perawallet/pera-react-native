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
import type { Decimal } from 'decimal.js'
import {
    addressOn,
    useAccountValueTotalsQuery,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import {
    LEGACY_CHAIN_ID,
    type ChainId,
} from '@perawallet/wallet-core-chain-contract'
import {
    useIsOnTestTier,
    useSelectedScope,
} from '@perawallet/wallet-core-chain-shared'

export type UseAccountWithBalanceResult = {
    nativeValue: Decimal | undefined
    isTestTier: boolean
}

export const useAccountWithBalance = (
    account: WalletAccount,
): UseAccountWithBalanceResult => {
    const scope = useSelectedScope(LEGACY_CHAIN_ID)
    const { accountValueTotals } = useAccountValueTotalsQuery(
        [account],
        scope,
        true,
    )
    const chainIds = useMemo(
        () => Object.keys(account.chains) as ChainId[],
        [account.chains],
    )
    const isTestTier = useIsOnTestTier(chainIds)

    return {
        nativeValue: accountValueTotals.get(addressOn(account, scope) ?? '')
            ?.nativeValue,
        isTestTier,
    }
}
