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

import { useCallback, useLayoutEffect } from 'react'
import type { WalletAccount } from '@perawallet/wallet-core-accounts'
import { useReceiveFunds } from '@modules/transactions/hooks'

type UseReceiveFundsBottomSheetResult = {
    hasAccount: boolean
}

export const useReceiveFundsBottomSheet = (
    isVisible: boolean,
    account: WalletAccount | undefined,
    onClose: () => void,
): UseReceiveFundsBottomSheetResult => {
    const {
        canSelectAccount,
        setSelectedAccount,
        setCanSelectAccount,
        setOnFinished,
        reset,
        selectedAccount,
    } = useReceiveFunds()

    useLayoutEffect(() => {
        if (isVisible && account != null) {
            if (canSelectAccount) {
                setCanSelectAccount(false)
            }

            if (selectedAccount?.address !== account.address) {
                setSelectedAccount(account)
            }
        }
    }, [
        isVisible,
        account,
        setCanSelectAccount,
        setSelectedAccount,
        canSelectAccount,
        selectedAccount?.address,
    ])

    const handleFinished = useCallback(() => {
        reset()
        onClose()
    }, [reset, onClose])

    useLayoutEffect(() => {
        if (isVisible) {
            setOnFinished(handleFinished)
        }
    }, [isVisible, handleFinished, setOnFinished])

    return {
        hasAccount: selectedAccount != null || !canSelectAccount,
    }
}
