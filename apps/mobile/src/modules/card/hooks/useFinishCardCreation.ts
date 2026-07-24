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
import { useAppNavigation } from '@hooks/useAppNavigation'
import { useLanguage } from '@hooks/useLanguage'
import { useToast } from '@hooks/useToast'
import { useRunAfterDelay } from '@hooks/useRunAfterDelay'

/** Leaves the success state on screen briefly before redirecting. */
const SUCCESS_DISPLAY_MS = 1500

export type UseFinishCardCreationResult = {
    /**
     * Persists the resolved funding type, invalidates card queries, shows the
     * success (or degraded) toast, and redirects to the card dashboard after
     * a brief delay. Shared by the last step of both funding-type paths:
     * Manual finishes after Step 2 (create + approve); Auto finishes after
     * Step 3 (LSig authorization).
     */
    finish: (fundingType: FundingType, autoFundingDegraded: boolean) => void
}

export const useFinishCardCreation = (): UseFinishCardCreationResult => {
    const { t } = useLanguage()
    const navigation = useAppNavigation()
    const queryClient = useQueryClient()
    const { successToast, infoToast } = useToast()
    const { schedule } = useRunAfterDelay()

    const finish = useCallback(
        (fundingType: FundingType, autoFundingDegraded: boolean) => {
            useCardStore.getState().setSelectedFundingType(fundingType)
            invalidateCardQueries(queryClient)

            if (autoFundingDegraded) {
                infoToast(
                    t('peraCard.setup_status.auto_funding_degraded_title'),
                    t('peraCard.setup_status.auto_funding_degraded_body'),
                )
            } else {
                successToast(
                    t('peraCard.setup_status.create_card_success_title'),
                    t('peraCard.setup_status.create_card_success_body'),
                )
            }

            schedule(() => {
                navigation.navigate('PeraCard', { screen: 'PeraCardAccount' })
            }, SUCCESS_DISPLAY_MS)
        },
        [queryClient, infoToast, successToast, t, schedule, navigation],
    )

    return { finish }
}
