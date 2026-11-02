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
import type { Optional } from '@perawallet/wallet-core-shared'
import { useSigningRequest } from '@perawallet/wallet-core-signing'
import {
    useSiteSafetyQuery,
    type SiteSafetyVerdict,
} from '@perawallet/wallet-core-site-safety'
import {
    hasSiteToCheck,
    signRequestSiteSafetyParams,
} from '@modules/site-safety'
import { createAcknowledgementStore } from './createAcknowledgementStore'

export type BlockedSite = Extract<SiteSafetyVerdict, { kind: 'blocked' }>

export type UseRequestSiteSafetyResult = {
    /** Set only for a phishing-list or WalletConnect Verify verdict; look-alike sites keep the gate's flow. */
    blockedSite: Optional<BlockedSite>
    isChecking: boolean
    isAcknowledged: boolean
    toggleAcknowledged: () => void
    isConfirmBlocked: boolean
}

export const useSiteWarningAcknowledgementStore = createAcknowledgementStore(
    'site-warning-acknowledgement-store',
)

const NO_SITE = { urls: [] }

export const useRequestSiteSafety = (): UseRequestSiteSafetyResult => {
    const { currentRequest } = useSigningRequest()
    const acknowledgedRequestId = useSiteWarningAcknowledgementStore(
        state => state.acknowledgedRequestId,
    )
    const setAcknowledgedRequestId = useSiteWarningAcknowledgementStore(
        state => state.setAcknowledgedRequestId,
    )

    // The gate's own params, so the cache key matches and the two never disagree.
    const params = currentRequest
        ? signRequestSiteSafetyParams(currentRequest)
        : NO_SITE
    const { verdict, isChecking } = useSiteSafetyQuery({
        ...params,
        isEnabled: hasSiteToCheck(params),
    })

    const blockedSite = verdict.kind === 'blocked' ? verdict : undefined
    const isAcknowledged =
        !!currentRequest && acknowledgedRequestId === currentRequest.id
    const toggleAcknowledged = useCallback(() => {
        if (!currentRequest) return
        setAcknowledgedRequestId(isAcknowledged ? undefined : currentRequest.id)
    }, [currentRequest, isAcknowledged, setAcknowledgedRequestId])

    return {
        blockedSite,
        isChecking,
        isAcknowledged,
        toggleAcknowledged,
        isConfirmBlocked: isChecking || (!!blockedSite && !isAcknowledged),
    }
}
