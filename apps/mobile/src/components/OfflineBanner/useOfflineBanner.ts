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

import { useEffect, useRef, useState } from 'react'
import { useNetworkStatus, useOfflineFeedbackStore } from '@modules/network'
import { useLanguage } from '@hooks/useLanguage'
import {
    OFFLINE_BANNER_EMPHASIS_MS,
    OFFLINE_RECONNECT_DISPLAY_MS,
} from '@constants/ui'

type OfflineBannerMode = 'offline' | 'reconnected'

type UseOfflineBannerResult = {
    isVisible: boolean
    mode: OfflineBannerMode
    label: string
    isEmphasized: boolean
}

export const useOfflineBanner = (): UseOfflineBannerResult => {
    const { hasInternet } = useNetworkStatus()
    const { t } = useLanguage()
    const emphasisNonce = useOfflineFeedbackStore(state => state.emphasisNonce)
    const [isReconnectedVisible, setIsReconnectedVisible] = useState(false)
    const [isEmphasized, setIsEmphasized] = useState(false)
    const previousHasInternet = useRef(hasInternet)
    const previousEmphasisNonce = useRef(emphasisNonce)
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const emphasisTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

    useEffect(() => {
        const wasOffline = previousHasInternet.current === false
        previousHasInternet.current = hasInternet

        const clearTimer = () => {
            if (timerRef.current) {
                clearTimeout(timerRef.current)
                timerRef.current = null
            }
        }

        if (!hasInternet) {
            // Offline again — kill any pending reconnect dismissal.
            clearTimer()
            setIsReconnectedVisible(false)
            return
        }

        if (wasOffline) {
            setIsReconnectedVisible(true)
            clearTimer()
            timerRef.current = setTimeout(() => {
                setIsReconnectedVisible(false)
                timerRef.current = null
            }, OFFLINE_RECONNECT_DISPLAY_MS)
        }
    }, [hasInternet])

    useEffect(() => {
        if (emphasisNonce === previousEmphasisNonce.current) return
        previousEmphasisNonce.current = emphasisNonce

        // Restart the window rather than stacking timers on repeated requests.
        if (emphasisTimerRef.current) clearTimeout(emphasisTimerRef.current)
        setIsEmphasized(true)
        emphasisTimerRef.current = setTimeout(() => {
            setIsEmphasized(false)
            emphasisTimerRef.current = null
        }, OFFLINE_BANNER_EMPHASIS_MS)
    }, [emphasisNonce])

    useEffect(
        () => () => {
            if (timerRef.current) clearTimeout(timerRef.current)
            if (emphasisTimerRef.current) clearTimeout(emphasisTimerRef.current)
        },
        [],
    )

    const mode: OfflineBannerMode = hasInternet ? 'reconnected' : 'offline'
    const isVisible = !hasInternet || isReconnectedVisible
    const label =
        mode === 'offline' ? t('common.offline_mode') : t('common.back_online')

    return { isVisible, mode, label, isEmphasized }
}
