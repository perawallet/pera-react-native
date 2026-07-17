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
import { useModalState } from '@hooks/useModalState'
import { trackEvent, MenuEvent } from '@analytics'

type UseMenuScreenResult = {
    isScannerVisible: boolean
    openScanner: () => void
    closeScanner: () => void
}

export const useMenuScreen = (): UseMenuScreenResult => {
    const scanner = useModalState()
    const { open } = scanner

    const openScanner = useCallback(() => {
        trackEvent(MenuEvent.QrScan)
        open()
    }, [open])

    return {
        isScannerVisible: scanner.isOpen,
        openScanner,
        closeScanner: scanner.close,
    }
}
