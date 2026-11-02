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

import { useState } from 'react'
import { useLockOverlayState } from '@hooks/useIsLockOverlayVisible'

type UseQRScannerLockCheckResult = {
    isScannerRequested: boolean
    isCoveredForLockCheck: boolean
}

/**
 * During the brief check after a return from the background, a scanner that
 * was already open stays presented but covered with the camera paused:
 * dismissing and re-presenting the Modal for it read as the scanner closing
 * and reopening. One requested during the check waits, so a cold start
 * doesn't flash a cover before the PIN screen.
 */
export const useQRScannerLockCheck = (
    isVisible: boolean,
): UseQRScannerLockCheckResult => {
    const lockOverlayState = useLockOverlayState()
    const [wasOpenBeforeLockCheck, setWasOpenBeforeLockCheck] = useState(false)
    if (lockOverlayState === 'none' && wasOpenBeforeLockCheck !== isVisible) {
        setWasOpenBeforeLockCheck(isVisible)
    }
    const isCoveredForLockCheck =
        lockOverlayState === 'checking' && wasOpenBeforeLockCheck
    return {
        isScannerRequested:
            isVisible && (lockOverlayState === 'none' || isCoveredForLockCheck),
        isCoveredForLockCheck,
    }
}
