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

import { useCallback, useEffect, useLayoutEffect } from 'react'
import type { WalletAccount } from '@perawallet/wallet-core-accounts'
import type { Optional } from '@perawallet/wallet-core-shared'
import { useBottomSheetResult } from '@modules/bottom-sheet'
import { useReceiveFunds } from '@modules/transactions/hooks'

type UseReceiveFundsContentResult = {
    hasAccount: boolean
}

export const useReceiveFundsContent = (
    account: Optional<WalletAccount>,
): UseReceiveFundsContentResult => {
    const {
        canSelectAccount,
        setSelectedAccount,
        setCanSelectAccount,
        setOnFinished,
        reset,
        selectedAccount,
    } = useReceiveFunds()
    const { dismiss } = useBottomSheetResult<void>()

    useLayoutEffect(() => {
        if (account != null) {
            if (canSelectAccount) {
                setCanSelectAccount(false)
            }

            if (selectedAccount?.address !== account.address) {
                setSelectedAccount(account)
            }
        }
    }, [
        account,
        setCanSelectAccount,
        setSelectedAccount,
        canSelectAccount,
        selectedAccount?.address,
    ])

    const handleFinished = useCallback(() => {
        reset()
        dismiss()
    }, [reset, dismiss])

    useLayoutEffect(() => {
        setOnFinished(handleFinished)
    }, [handleFinished, setOnFinished])

    // Same teardown contract as the send sheet: the store is a module singleton
    // that outlives this sheet, and `onFinished` only fires from the ✕ button,
    // so any other dismissal used to strand `canSelectAccount: false` and open
    // the next Receive on the previous account's QR instead of the picker.
    // Teardown, not mount — AccountOverview sets the account on the store
    // *before* opening the sheet, so a mount-time reset would wipe it.
    useEffect(() => () => reset(), [reset])

    return {
        hasAccount: selectedAccount != null || !canSelectAccount,
    }
}
