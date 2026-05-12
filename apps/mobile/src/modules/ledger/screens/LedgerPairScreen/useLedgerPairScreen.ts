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
import { Linking } from 'react-native'
import { useAppNavigation } from '@hooks/useAppNavigation'
import { useLanguage } from '@hooks/useLanguage'

type UseLedgerPairScreenResult = {
    isHowDoesItWorkVisible: boolean
    handlePair: () => void
    handleOpenHowDoesItWork: () => void
    handleCloseHowDoesItWork: () => void
    handleOpenSupport: () => void
    t: (key: string, options?: Record<string, unknown>) => string
}

export const useLedgerPairScreen = (): UseLedgerPairScreenResult => {
    const { t } = useLanguage()
    const navigation = useAppNavigation()
    const [isHowDoesItWorkVisible, setHowDoesItWorkVisible] = useState(false)

    const handlePair = useCallback(() => {
        navigation.navigate('LedgerScan')
    }, [navigation])

    const handleOpenHowDoesItWork = useCallback(() => {
        setHowDoesItWorkVisible(true)
    }, [])

    const handleCloseHowDoesItWork = useCallback(() => {
        setHowDoesItWorkVisible(false)
    }, [])

    const handleOpenSupport = useCallback(() => {
        Linking.openURL(t('ledger.pair.support_url')).catch(() => {
            // Browser missing or URL unhandleable — silently no-op rather
            // than crashing with an unhandled promise rejection.
        })
    }, [t])

    return {
        isHowDoesItWorkVisible,
        handlePair,
        handleOpenHowDoesItWork,
        handleCloseHowDoesItWork,
        handleOpenSupport,
        t,
    }
}
