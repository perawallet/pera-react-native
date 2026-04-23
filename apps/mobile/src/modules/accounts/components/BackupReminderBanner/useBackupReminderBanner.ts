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

import { useCallback, useMemo } from 'react'
import { Decimal } from 'decimal.js'
import {
    useAccountBalancesQuery,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import { ALGO_ASSET_ID } from '@perawallet/wallet-core-assets'
import { useRequiresMnemonicBackup } from '@perawallet/wallet-core-backup'
import { useBackupFlowLauncher } from '@modules/backup'

export type UseBackupReminderBannerResult = {
    isVisible: boolean
    onPress: () => void
}

export const useBackupReminderBanner = (
    account: WalletAccount,
): UseBackupReminderBannerResult => {
    const requiresBackup = useRequiresMnemonicBackup(account)
    const accountsForBalances = useMemo(() => [account], [account])
    const { accountBalances } = useAccountBalancesQuery(accountsForBalances)
    const launch = useBackupFlowLauncher()

    const balanceEntry = accountBalances.get(account.address)
    const algoBalance: Decimal =
        balanceEntry?.assetBalances.find(b => b.assetId === ALGO_ASSET_ID)
            ?.amount ?? new Decimal(0)

    const isVisible = requiresBackup && algoBalance.gt(0)

    const onPress = useCallback(() => launch(account), [launch, account])

    return { isVisible, onPress }
}
