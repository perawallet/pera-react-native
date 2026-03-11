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

import { useCallback } from 'react'
import {
    useAllAccounts,
    useSelectedAccountAddress,
    useAccountBalancesQuery,
    useSortedAccounts,
    WalletAccount,
} from '@perawallet/wallet-core-accounts'
import { useModalState } from '@hooks/useModalState'
import { AccountMenuProps } from './AccountMenu'

type UseAccountMenuResult = {
    sortedAccounts: WalletAccount[]
    selectedAccountAddress: string | null
    handleTap: (acct: WalletAccount) => void
    isSortSheetVisible: boolean
    handleOpenSort: () => void
    handleCloseSort: () => void
}

export const useAccountMenu = (
    props: AccountMenuProps,
): UseAccountMenuResult => {
    const accounts = useAllAccounts()
    const { selectedAccountAddress, setSelectedAccountAddress } =
        useSelectedAccountAddress()
    const { accountBalances } = useAccountBalancesQuery(accounts, true)
    const { sortedAccounts } = useSortedAccounts(accounts, accountBalances)
    const {
        isOpen: isSortSheetVisible,
        open: handleOpenSort,
        close: handleCloseSort,
    } = useModalState()

    const handleTap = useCallback(
        (acct: WalletAccount) => {
            setSelectedAccountAddress(acct.address)
            props?.onSelected?.(acct)
        },
        [props, setSelectedAccountAddress],
    )

    return {
        sortedAccounts,
        selectedAccountAddress,
        handleTap,
        isSortSheetVisible,
        handleOpenSort,
        handleCloseSort,
    }
}
