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
import { usePinCode } from '@perawallet/wallet-core-security'
import { useBottomSheet } from '@modules/bottom-sheet'
import { PinEditContent } from '../components/PinEditContent'

export type UseRequirePinVerificationResult = {
    /**
     * Verifies the PIN when one is set. Resolves true when verified (or no PIN
     * is configured) and false when the user cancels or fails.
     */
    requirePinVerification: () => Promise<boolean>
}

/** Shared PIN gate for sensitive actions (view passphrase, authorize delegation). */
export const useRequirePinVerification =
    (): UseRequirePinVerificationResult => {
        const { checkPinEnabled } = usePinCode()
        const { request: requestBottomSheet } = useBottomSheet()

        const requirePinVerification = useCallback(async () => {
            if (!(await checkPinEnabled())) return true
            const verified = await requestBottomSheet<boolean>({
                contents: <PinEditContent mode='verify' />,
                options: {
                    size: 'full',
                    enablePanDownToClose: false,
                    enableCloseOnBackdropPress: false,
                    // gorhom's BottomSheetView is top-anchored and content-sized,
                    // so the PIN layout can't flex-fill the sheet; use the plain
                    // flex container instead.
                    autoCreateContainer: false,
                },
            })
            return verified === true
        }, [checkPinEnabled, requestBottomSheet])

        return { requirePinVerification }
    }
