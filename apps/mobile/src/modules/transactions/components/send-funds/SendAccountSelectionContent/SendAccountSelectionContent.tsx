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

import { useCallback, useMemo } from 'react'
import {
    chainAccountOf,
    useAccountsStore,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import type { ChainId } from '@perawallet/wallet-core-chain-contract'
import { PWSheetLayout } from '@components/core'
import { AccountPicker } from '@components/AccountPicker'
import { SheetHeader, useBottomSheetResult } from '@modules/bottom-sheet'
import { useLanguage } from '@hooks/useLanguage'

export type SendAccountSelectionContentProps = {
    chainId: ChainId
    /** The accounts that can send on `chainId`; the caller already filtered them. */
    accountIds: string[]
}

/** Resolves the picked account's id. */
export const SendAccountSelectionContent = ({
    chainId,
    accountIds,
}: SendAccountSelectionContentProps) => {
    const { t } = useLanguage()
    const { resolve } = useBottomSheetResult<string>()
    const allAccounts = useAccountsStore(state => state.accounts)
    const accounts = useMemo(
        () => allAccounts.filter(({ id }) => accountIds.includes(id)),
        [allAccounts, accountIds],
    )
    const selectedAccountId = useAccountsStore(state => state.selectedAccountId)
    const highlighted = accounts.find(({ id }) => id === selectedAccountId)

    const handleSelect = useCallback(
        (account: WalletAccount) => resolve(account.id),
        [resolve],
    )

    return (
        <PWSheetLayout
            header={<SheetHeader title={t('send_funds.select_sender.title')} />}
        >
            <AccountPicker
                accounts={accounts}
                onSelect={handleSelect}
                highlightedAddress={
                    highlighted && chainAccountOf(highlighted, chainId)?.address
                }
                rowTestIDPrefix='send_account'
                chainId={chainId}
                isEmbedded
            />
        </PWSheetLayout>
    )
}
