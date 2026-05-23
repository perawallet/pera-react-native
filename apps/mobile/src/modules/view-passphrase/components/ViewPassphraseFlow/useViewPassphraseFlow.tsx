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
import { usePinCode } from '@perawallet/wallet-core-security'
import { useBottomSheet } from '@modules/bottom-sheet'
import { PinEditContent } from '@modules/security'
import {
    PassphraseAcknowledgeContent,
    type PassphraseAcknowledgeContentResult,
} from '../PassphraseAcknowledgeContent'
import { ViewPassphraseContent } from '../ViewPassphraseContent'

export type UseViewPassphraseFlowResult = {
    openViewPassphraseFlow: (address: string) => Promise<void>
}

/**
 * Imperative view-passphrase flow: PIN gate (if enabled) → acknowledge →
 * display. Each step opens via the managed bottom-sheet system, so the
 * flow runs even if the caller's host sheet has been dismissed (which is
 * desirable — callers like AccountOptionsContent dismiss themselves
 * before opening this flow to avoid stacked sheets).
 */
export const useViewPassphraseFlow = (): UseViewPassphraseFlowResult => {
    const { checkPinEnabled } = usePinCode()
    const { request: requestBottomSheet } = useBottomSheet()

    const openViewPassphraseFlow = useCallback(
        async (address: string) => {
            const pinEnabled = await checkPinEnabled()
            if (pinEnabled) {
                const verified = await requestBottomSheet<boolean>({
                    contents: <PinEditContent mode='verify' />,
                    options: {
                        size: 'full',
                        enablePanDownToClose: false,
                        enableCloseOnBackdropPress: false,
                    },
                })
                if (verified !== true) return
            }

            const ack =
                await requestBottomSheet<PassphraseAcknowledgeContentResult>({
                    contents: <PassphraseAcknowledgeContent />,
                    options: {
                        size: 'lg',
                        enablePanDownToClose: true,
                        autoCreateContainer: false,
                    },
                })
            if (ack !== 'confirm') return

            await requestBottomSheet<void>({
                contents: <ViewPassphraseContent address={address} />,
                options: { size: 'lg', enablePanDownToClose: true },
            })
        },
        [checkPinEnabled, requestBottomSheet],
    )

    return { openViewPassphraseFlow }
}
