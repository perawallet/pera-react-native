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

import { useCallback } from 'react'
import type { WalletAccount } from '@perawallet/wallet-core-accounts'
import type { ChainId } from '@perawallet/wallet-core-chain-contract'
import type { Nullable } from '@perawallet/wallet-core-shared'
import { PWSheetLayout } from '@components/core'
import { AccountPicker } from '@components/AccountPicker'
import { SheetHeader, useBottomSheetResult } from '@modules/bottom-sheet'
import { useLanguage } from '@hooks/useLanguage'

export type SwapReceivingAccountContentProps = {
    accounts: WalletAccount[]
    chainId: ChainId
    selectedAddress: Nullable<string>
    onSelect: (account: WalletAccount) => void
}

export const SwapReceivingAccountContent = ({
    accounts,
    chainId,
    selectedAddress,
    onSelect,
}: SwapReceivingAccountContentProps) => {
    const { t } = useLanguage()
    const { resolve } = useBottomSheetResult<string>()

    const handleSelect = useCallback(
        (account: WalletAccount) => {
            onSelect(account)
            resolve(account.id)
        },
        [onSelect, resolve],
    )

    return (
        <PWSheetLayout
            header={<SheetHeader title={t('swap.receiving_account.title')} />}
        >
            <AccountPicker
                accounts={accounts}
                onSelect={handleSelect}
                highlightedAddress={selectedAddress ?? undefined}
                rowTestIDPrefix='swap_receiving_account'
                chainId={chainId}
                isEmbedded
            />
        </PWSheetLayout>
    )
}
