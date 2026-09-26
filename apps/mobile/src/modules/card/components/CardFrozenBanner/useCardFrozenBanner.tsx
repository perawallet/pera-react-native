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
import {
    CardStatus,
    useCardStatusQuery,
    useIsCardUnfreezing,
} from '@perawallet/wallet-core-card'
import { trackEvent, CardEvent } from '@analytics'
import { useBottomSheet } from '@modules/bottom-sheet'
import { UnfreezeCardConfirmationSheet } from '../UnfreezeCardConfirmationSheet'

type UseCardFrozenBannerResult = {
    /** True only when the card status is FROZEN — the banner self-hides otherwise. */
    isFrozen: boolean
    /** True while an unfreeze request is in flight (shared with the options row). */
    isReactivating: boolean
    onReactivate: () => void
}

export const useCardFrozenBanner = (): UseCardFrozenBannerResult => {
    const { data: card } = useCardStatusQuery()
    const isFrozen = card?.status === CardStatus.Frozen

    // Shared across the banner + the Card Details options row so the in-flight
    // unfreeze state (driven by the confirmation sheet) reflects on both.
    const isReactivating = useIsCardUnfreezing()
    const { request } = useBottomSheet()

    // Unfreezing is confirmed AND executed inside the sheet; here we only open it.
    const onReactivate = useCallback(() => {
        trackEvent(CardEvent.FreezeReactivate)
        void request({
            contents: <UnfreezeCardConfirmationSheet />,
            options: {
                size: 'auto',
                enablePanDownToClose: true,
            },
        })
    }, [request])

    return {
        isFrozen,
        isReactivating,
        onReactivate,
    }
}
