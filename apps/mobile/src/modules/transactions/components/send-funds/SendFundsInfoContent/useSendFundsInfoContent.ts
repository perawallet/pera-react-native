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

import { usePreferences } from '@perawallet/wallet-core-settings'
import { UserPreferences } from '@constants/user-preferences'
import { useWebView } from '@modules/webview/hooks'
import { config } from '@perawallet/wallet-core-config'
import { generateOrderedUniqueId } from '@perawallet/wallet-core-shared'

type UseSendFundsInfoContentResult = {
    handleOpenInfoLink: () => void
    handleClose: () => void
}

export const useSendFundsInfoContent = (
    onClose: () => void,
): UseSendFundsInfoContentResult => {
    const { setPreference } = usePreferences()
    const { pushWebView } = useWebView()

    const handleOpenInfoLink = () => {
        pushWebView({
            id: generateOrderedUniqueId(),
            url: config.sendFundsFaqUrl,
        })
    }

    const handleClose = () => {
        setPreference(UserPreferences.transactionInfoAgreed, true)
        onClose()
    }

    return {
        handleOpenInfoLink,
        handleClose,
    }
}
