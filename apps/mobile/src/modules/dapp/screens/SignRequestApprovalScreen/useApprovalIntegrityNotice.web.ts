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

import { useCallback, useRef } from 'react'
import { openExpandedTab } from '@perawallet/wallet-core-browser-runtime'
import { logger } from '@perawallet/wallet-core-shared'
import { useIntegrityAccessState } from '@hooks/useIntegrityAccessState.web'
import { useIntegrityFeedbackStore } from '@hooks/useIntegrityFeedbackStore'

export type UseApprovalIntegrityNoticeResult = {
    isVisible: boolean
    /** The check cannot host in an approval window; the expanded tab can. */
    onOpenPera: () => void
}

/**
 * Shows only when a Pera call made while this approval is open was refused
 * for want of a token (a sponsored fee, a cosign, asset metadata): that is
 * when this request needs Pera. Connect and plain signing never trip it.
 */
export const useApprovalIntegrityNotice =
    (): UseApprovalIntegrityNoticeResult => {
        const { state } = useIntegrityAccessState()
        const emphasisNonce = useIntegrityFeedbackStore(
            store => store.emphasisNonce,
        )
        const nonceAtOpen = useRef(emphasisNonce)
        const wasRefusedHere = emphasisNonce !== nonceAtOpen.current

        const onOpenPera = useCallback(() => {
            openExpandedTab().catch((error: unknown) => {
                logger.warn('Opening Pera from an approval failed', { error })
            })
        }, [])

        return {
            isVisible: wasRefusedHere && state.status !== 'ready',
            onOpenPera,
        }
    }
