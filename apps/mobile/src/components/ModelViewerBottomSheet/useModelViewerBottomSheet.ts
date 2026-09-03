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

import {
    type RefObject,
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from 'react'
import type { WebViewMessageEvent } from 'react-native-webview'
import { useTheme } from '@rneui/themed'
import type { BottomSheetModal } from '@gorhom/bottom-sheet'
import { buildModelViewerHtml } from './modelViewerHtml'
import { logger, type Nullable } from '@perawallet/wallet-core-shared'

type GradientColors = readonly [string, string, ...string[]]

type UseModelViewerBottomSheetParams = {
    isVisible: boolean
    modelUrl: string
}

type UseModelViewerBottomSheetResult = {
    sheetRef: RefObject<Nullable<BottomSheetModal>>
    html: Nullable<string>
    isLoading: boolean
    gradientColors: GradientColors
    handleMessage: (event: WebViewMessageEvent) => void
}

export const useModelViewerBottomSheet = ({
    isVisible,
    modelUrl,
}: UseModelViewerBottomSheetParams): UseModelViewerBottomSheetResult => {
    const { theme } = useTheme()
    const sheetRef = useRef<BottomSheetModal>(null)
    const [isLoading, setIsLoading] = useState(true)

    useEffect(() => {
        if (isVisible) {
            setIsLoading(true)
            sheetRef.current?.present()
        } else {
            sheetRef.current?.dismiss()
        }
    }, [isVisible])

    const html = useMemo(() => {
        if (!modelUrl) {
            return null
        }
        try {
            return buildModelViewerHtml({ modelUrl })
        } catch (error) {
            logger.warn('Refusing to render model viewer with unsafe URL', {
                error,
            })
            return null
        }
    }, [modelUrl])

    const handleMessage = useCallback((event: WebViewMessageEvent) => {
        try {
            const payload = JSON.parse(event.nativeEvent.data) as {
                type?: string
            }
            if (payload?.type === 'loaded' || payload?.type === 'error') {
                setIsLoading(false)
            }
        } catch {
            // ignore non-JSON messages
        }
    }, [])

    const gradientColors = useMemo<GradientColors>(
        () => [
            theme.colors.trustedIconBg,
            theme.colors.wallet1,
            theme.colors.wallet4Icon,
        ],
        [
            theme.colors.trustedIconBg,
            theme.colors.wallet1,
            theme.colors.wallet4Icon,
        ],
    )

    return {
        sheetRef,
        html,
        isLoading,
        gradientColors,
        handleMessage,
    }
}
