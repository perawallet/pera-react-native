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

import { useEffect } from 'react'
import { useSigningRequest } from '@perawallet/wallet-core-signing'
import {
    useFlagReviewRisk,
    useReviewRiskFlagStore,
    useReviewRiskGate,
} from '../../hooks/useReviewRiskGate'
import type { ReviewWarningItem } from './types'

export type UseReviewWarningsBannerResult = {
    /** Two or more items fold behind a count; one shows in full. */
    isCollapsible: boolean
    hasHighRisk: boolean
    isAcknowledged: boolean
    toggleAcknowledged: () => void
}

export const useReviewWarningsBanner = (
    items: readonly ReviewWarningItem[],
): UseReviewWarningsBannerResult => {
    const hasHighRisk = items.some(item => item.isHighRisk)
    const highRiskIds = items
        .filter(item => item.isHighRisk)
        .map(item => item.id)
        .sort()
        .join('|')
    useFlagReviewRisk(hasHighRisk)
    const { isAcknowledged, toggleAcknowledged } = useReviewRiskGate()
    const { currentRequest } = useSigningRequest()
    const requestId = currentRequest?.id

    useEffect(() => {
        if (!requestId || !highRiskIds) return
        useReviewRiskFlagStore
            .getState()
            .noteHighRisk(requestId, highRiskIds.split('|'))
    }, [highRiskIds, requestId])

    return {
        isCollapsible: items.length > 1,
        hasHighRisk,
        isAcknowledged,
        toggleAcknowledged,
    }
}
