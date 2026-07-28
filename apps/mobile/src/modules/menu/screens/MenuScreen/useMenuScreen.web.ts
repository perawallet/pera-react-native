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

import { useCallback } from 'react'
import { useNavigation, type NavigationProp } from '@react-navigation/native'
import { getSurface } from '@perawallet/wallet-extension-platform-chrome'
import { useModalState } from '@hooks/useModalState'
import type { RootStackParamList } from '@routes/types'
import { trackEvent, MenuEvent } from '@analytics'

type UseMenuScreenResult = {
    isScannerVisible: boolean
    openScanner: () => void
    closeScanner: () => void
}

/**
 * Web scan action: the popup now opens the same sheet as native
 * (`QRScannerView`/`QRScannerContent.web`) — that content itself decides
 * whether to auto-start the camera inline (permission already 'granted') or
 * fall back to the expanded-tab hand-off button (permission 'prompt'/denied),
 * so this hook no longer needs to special-case the popup by skipping straight
 * to `openExpandedTab`. The expanded tab still navigates to the full-page
 * ScanQR route, matching its own scanner mount rather than a bottom sheet.
 */
export const useMenuScreen = (): UseMenuScreenResult => {
    const navigation = useNavigation<NavigationProp<RootStackParamList>>()
    const scanner = useModalState()
    const { open } = scanner

    const openScanner = useCallback(() => {
        trackEvent(MenuEvent.QrScan)
        if (getSurface() === 'popup') {
            open()
            return
        }
        navigation.navigate('ScanQR')
    }, [navigation, open])

    return {
        isScannerVisible: scanner.isOpen,
        openScanner,
        closeScanner: scanner.close,
    }
}
