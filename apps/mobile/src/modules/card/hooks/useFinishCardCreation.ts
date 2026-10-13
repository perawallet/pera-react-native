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
import { useQueryClient } from '@tanstack/react-query'
import {
    invalidateCardQueries,
    useCardStore,
    type FundingType,
} from '@perawallet/wallet-core-card'
import { EXTENDED_TOAST_DURATION_MS } from '@constants/ui'
import { useAppNavigation } from '@hooks/useAppNavigation'
import { useLanguage } from '@hooks/useLanguage'
import { useToast } from '@hooks/useToast'
import { useRunAfterDelay } from '@hooks/useRunAfterDelay'

/** Leaves the success state on screen briefly before redirecting. */
const SUCCESS_DISPLAY_MS = 1500

export type UseFinishCardCreationResult = {
    /**
     * Persists the resolved funding type, invalidates card queries, and after
     * a brief delay redirects to the card dashboard and shows the success (or
     * degraded) toast there. Shared by the last step of both funding-type
     * paths: Manual finishes after Step 2 (create + approve); Auto finishes
     * after Step 3 (LSig authorization).
     */
    finish: (fundingType: FundingType, autoFundingDegraded: boolean) => void
}

export const useFinishCardCreation = (): UseFinishCardCreationResult => {
    const { t } = useLanguage()
    const navigation = useAppNavigation()
    const queryClient = useQueryClient()
    const { successToast, showToast } = useToast()
    const { schedule } = useRunAfterDelay()

    const finish = useCallback(
        (fundingType: FundingType, autoFundingDegraded: boolean) => {
            useCardStore.getState().setSelectedFundingType(fundingType)
            invalidateCardQueries(queryClient)

            schedule(() => {
                // Popping the root back to the tab bar also dismisses the
                // onboarding stack this runs from.
                navigation.navigate('TabBar', {
                    screen: 'Home',
                    params: { screen: 'PeraCardAccount' },
                })
                // Shown after the pop: fired before it, the toast spent most of
                // its 3s default under the screen transition and was unreadable.
                if (autoFundingDegraded) {
                    showToast(
                        {
                            title: t(
                                'peraCard.setup_status.auto_funding_degraded_title',
                            ),
                            body: t(
                                'peraCard.setup_status.auto_funding_degraded_body',
                            ),
                            type: 'info',
                        },
                        { duration: EXTENDED_TOAST_DURATION_MS },
                    )
                    return
                }
                successToast(
                    t('peraCard.setup_status.create_card_success_title'),
                    t('peraCard.setup_status.create_card_success_body'),
                )
            }, SUCCESS_DISPLAY_MS)
        },
        [queryClient, showToast, successToast, t, schedule, navigation],
    )

    return { finish }
}
