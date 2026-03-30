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
import { useClipboard } from '@hooks/useClipboard'
import { useToast } from '@hooks/useToast'
import { useLanguage } from '@hooks/useLanguage'
import { useAccountOverviewModal } from '../AccountOverview/AccountOverviewModalContext'

export type UseWatchAccountButtonPanelResult = {
    handleCopyAddress: () => void
    handleShowQR: () => void
    handleMore: () => void
}

export const useWatchAccountButtonPanel =
    (): UseWatchAccountButtonPanelResult => {
        const { account, openReceiveFunds, openAccountOptions } =
            useAccountOverviewModal()
        const { copyToClipboard } = useClipboard()
        const { showToast } = useToast()
        const { t } = useLanguage()

        const handleCopyAddress = useCallback(() => {
            copyToClipboard(account.address)
            showToast({
                title: t('account_options.copy_address'),
                body: '',
                type: 'success',
            })
        }, [copyToClipboard, account.address, showToast, t])

        return {
            handleCopyAddress,
            handleShowQR: openReceiveFunds,
            handleMore: openAccountOptions,
        }
    }
