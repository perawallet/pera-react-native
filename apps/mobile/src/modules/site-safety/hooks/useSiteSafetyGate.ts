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

import { useCallback, useState } from 'react'
import {
    useSiteSafetyQuery,
    type AssessSiteSafetyParams,
    type SiteSafetyVerdict,
} from '@perawallet/wallet-core-site-safety'

export type UseSiteSafetyGateResult = {
    verdict: SiteSafetyVerdict
    isChecking: boolean
    isBlockedViewShown: boolean
    isLookAlikeWarningShown: boolean
    /** False until the check settles and any block or warning has been passed. */
    isApprovalAllowed: boolean
    isContinueAnywayRevealed: boolean
    isRiskAcknowledged: boolean
    handleRevealContinueAnyway: () => void
    handleToggleRiskAcknowledged: () => void
    handleContinueAnyway: () => void
    handleAcknowledgeLookAlike: () => void
}

export const useSiteSafetyGate = (
    params: AssessSiteSafetyParams,
): UseSiteSafetyGateResult => {
    // A local request names no site; checking it would only flash a spinner.
    const hasSite =
        params.isFlaggedByWalletConnectVerify === true ||
        params.urls.some(url => !!url)
    const { verdict, isChecking } = useSiteSafetyQuery({
        ...params,
        isEnabled: hasSite,
    })
    const [isContinueAnywayRevealed, setIsContinueAnywayRevealed] =
        useState(false)
    const [isRiskAcknowledged, setIsRiskAcknowledged] = useState(false)
    const [hasContinuedAnyway, setHasContinuedAnyway] = useState(false)
    const [hasAcknowledgedLookAlike, setHasAcknowledgedLookAlike] =
        useState(false)

    const isBlockedViewShown =
        !isChecking && verdict.kind === 'blocked' && !hasContinuedAnyway
    const isLookAlikeWarningShown =
        !isChecking &&
        verdict.kind === 'look-alike' &&
        !hasAcknowledgedLookAlike

    const handleRevealContinueAnyway = useCallback((): void => {
        setIsContinueAnywayRevealed(true)
    }, [])

    const handleToggleRiskAcknowledged = useCallback((): void => {
        setIsRiskAcknowledged(previous => !previous)
    }, [])

    const handleContinueAnyway = useCallback((): void => {
        if (!isRiskAcknowledged) return
        setHasContinuedAnyway(true)
    }, [isRiskAcknowledged])

    const handleAcknowledgeLookAlike = useCallback((): void => {
        setHasAcknowledgedLookAlike(true)
    }, [])

    return {
        verdict,
        isChecking,
        isBlockedViewShown,
        isLookAlikeWarningShown,
        isApprovalAllowed:
            !isChecking && !isBlockedViewShown && !isLookAlikeWarningShown,
        isContinueAnywayRevealed,
        isRiskAcknowledged,
        handleRevealContinueAnyway,
        handleToggleRiskAcknowledged,
        handleContinueAnyway,
        handleAcknowledgeLookAlike,
    }
}
