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

import { useCallback, useState } from 'react'
import {
    useSelectedAccount,
    WalletAccount,
} from '@perawallet/wallet-core-accounts'
import { useModalState } from '@hooks/useModalState'
import { useReceiveFunds } from '@modules/transactions/hooks'

export type UseAccountOverviewResult = {
    isSendFundsVisible: boolean
    openSendFunds: () => void
    handleCloseSendFunds: () => void
    isReceiveFundsVisible: boolean
    openReceiveFunds: () => void
    handleCloseReceiveFunds: () => void
    isAccountOptionsVisible: boolean
    openAccountOptions: () => void
    handleCloseAccountOptions: () => void
    scrollingEnabled: boolean
    onScrollEnabledChange: (enabled: boolean) => void
}

export const useAccountOverview = (
    _account: WalletAccount,
): UseAccountOverviewResult => {
    const selectedAccount = useSelectedAccount()
    const { setSelectedAccount, setCanSelectAccount } = useReceiveFunds()

    const {
        isOpen: isSendFundsVisible,
        open: openSendFunds,
        close: handleCloseSendFunds,
    } = useModalState()

    const {
        isOpen: isReceiveFundsVisible,
        open: handleOpenReceiveFunds,
        close: handleCloseReceiveFunds,
    } = useModalState()

    const {
        isOpen: isAccountOptionsVisible,
        open: openAccountOptions,
        close: handleCloseAccountOptions,
    } = useModalState()

    const openReceiveFunds = useCallback(() => {
        if (selectedAccount) {
            setCanSelectAccount(false)
            setSelectedAccount(selectedAccount)
        }
        handleOpenReceiveFunds()
    }, [
        selectedAccount,
        handleOpenReceiveFunds,
        setCanSelectAccount,
        setSelectedAccount,
    ])

    const [scrollingEnabled, setScrollingEnabled] = useState<boolean>(true)

    const onScrollEnabledChange = useCallback(
        (enabled: boolean) => {
            setScrollingEnabled(enabled)
        },
        [setScrollingEnabled],
    )

    return {
        isSendFundsVisible,
        openSendFunds,
        handleCloseSendFunds,
        isReceiveFundsVisible,
        openReceiveFunds,
        handleCloseReceiveFunds,
        isAccountOptionsVisible,
        openAccountOptions,
        handleCloseAccountOptions,
        scrollingEnabled,
        onScrollEnabledChange,
    }
}
