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
import {
    CardStatus,
    useCardStatusQuery,
    useIsCardUnfreezing,
    useUnfreezeCardMutation,
} from '@perawallet/wallet-core-card'
import { useCardErrorToast } from '../../hooks'

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

    const unfreeze = useUnfreezeCardMutation()
    // Shared across the banner + the Card Details options row so the two
    // unfreeze entry points can't fire concurrently and both reflect the
    // in-flight state.
    const isReactivating = useIsCardUnfreezing()
    const showError = useCardErrorToast()

    const reactivate = useCallback(async () => {
        if (isReactivating) return
        try {
            await unfreeze.mutateAsync()
        } catch (error) {
            await showError(error)
        }
    }, [isReactivating, unfreeze, showError])
    const onReactivate = useCallback(() => {
        void reactivate()
    }, [reactivate])

    return {
        isFrozen,
        isReactivating,
        onReactivate,
    }
}
