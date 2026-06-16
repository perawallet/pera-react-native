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
import {
    canSignWith,
    useAccountsStore,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import { PWSheetLayout } from '@components/core'
import { SheetHeader, useBottomSheetResult } from '@modules/bottom-sheet'
import { AccountPicker } from '@modules/accounts/components/AccountPicker'
import { useLanguage } from '@hooks/useLanguage'

export type OptInAccountSelectionContentProps = {
    /** Pre-highlights an account in the list (e.g. the currently selected one). */
    highlightedAddress?: string
}

/**
 * Account picker shown before an opt-in started from a deep link, so the user
 * chooses which account opts in. Resolves the selected account's address; only
 * accounts the wallet can actually sign with are offered (watch-only and
 * otherwise unsignable accounts are filtered out).
 */
export const OptInAccountSelectionContent = ({
    highlightedAddress,
}: OptInAccountSelectionContentProps) => {
    const { t } = useLanguage()
    const { resolve } = useBottomSheetResult<string>()
    const accounts = useAccountsStore(state => state.accounts)

    const signableAccounts = useMemo(
        () => accounts.filter(account => canSignWith(account, accounts)),
        [accounts],
    )

    const handleSelect = useCallback(
        (account: WalletAccount) => resolve(account.address),
        [resolve],
    )

    return (
        <PWSheetLayout
            header={<SheetHeader title={t('add_asset.select_account.title')} />}
        >
            <AccountPicker
                accounts={signableAccounts}
                onSelect={handleSelect}
                highlightedAddress={highlightedAddress}
                emptyBody={t('add_asset.select_account.empty')}
                rowTestIDPrefix='opt_in_account'
            />
        </PWSheetLayout>
    )
}
