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

import { useEffect, useState } from 'react'
import { usePreferences } from '@perawallet/wallet-core-settings'
import { UserPreferences } from '@constants/user-preferences'
import { useWebView } from '@hooks/usePeraWebviewInterface'
import { v7 as uuid } from 'uuid'
import { config } from '@perawallet/wallet-core-config'

type UseSendFundsInfoPanelResult = {
    forceOpen: boolean
    handleOpenInfoLink: () => void
    handleClose: () => void
}

export const useSendFundsInfoPanel = (
    onClose: () => void,
): UseSendFundsInfoPanelResult => {
    const { getPreference, setPreference } = usePreferences()
    const [forceOpen, setForceOpen] = useState(false)
    const hasAgreed = getPreference(UserPreferences.spendAgreed)
    const { pushWebView } = useWebView()

    useEffect(() => {
        if (!hasAgreed) {
            setTimeout(() => {
                setForceOpen(true)
            }, 300)
        } else {
            setForceOpen(false)
        }
    }, [hasAgreed])

    const handleOpenInfoLink = () => {
        pushWebView({
            id: uuid(),
            url: config.sendFundsFaqUrl,
        })
    }

    const handleClose = () => {
        setPreference(UserPreferences.spendAgreed, true)
        onClose()
    }

    return {
        forceOpen,
        handleOpenInfoLink,
        handleClose,
    }
}
