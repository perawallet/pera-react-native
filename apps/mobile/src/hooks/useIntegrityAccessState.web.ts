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

import { useCallback, useMemo } from 'react'
import { config } from '@perawallet/wallet-core-config'
import {
    deriveIntegrityAccessState,
    sendIntegrityControl,
    type IntegrityAccessState,
} from '@perawallet/wallet-core-browser-runtime'
import { useIntegrityCheckFrameStore } from '@components/IntegrityCheckFrameHost'
import { useIsOnboarding } from '@modules/onboarding'
import { useNetworkStatus } from './useNetworkStatusStore'
import { useShowOnboarding } from './useShowOnboarding'
import { useIntegrityAccessStore } from './useIntegrityAccessStore.web'

export type UseIntegrityAccessStateResult = {
    state: IntegrityAccessState
    /** Asks the worker to mint now, past its backoff. */
    retry: () => void
    /** Re-shows a live check the user dismissed, or starts a new one. */
    verify: () => void
}

const ALWAYS_READY: IntegrityAccessState = {
    status: 'ready',
    expiresAt: Number.POSITIVE_INFINITY,
}

export const useIntegrityAccessState = (): UseIntegrityAccessStateResult => {
    const snapshot = useIntegrityAccessStore(state => state.snapshot)
    const now = useIntegrityAccessStore(state => state.now)
    const pendingSince = useIntegrityAccessStore(state => state.pendingSince)
    const { hasInternet } = useNetworkStatus()
    const frameUrl = useIntegrityCheckFrameStore(state => state.url)
    const isFrameExpanded = useIntegrityCheckFrameStore(
        state => state.isExpanded,
    )
    const isFrameDismissed = useIntegrityCheckFrameStore(
        state => state.isDismissed,
    )
    // The check host starts no check before the user commits to onboarding,
    // so a missing enrolment until then is nothing they can act on.
    const isShowingOnboarding = useShowOnboarding()
    const { isOnboarding: hasCommittedToOnboarding } = useIsOnboarding()
    const isEnrolmentDeferred = isShowingOnboarding && !hasCommittedToOnboarding
    // Without a bearer the token is not this build's credential, so its state
    // must never put a surface into a degraded arm.
    const isTokenCredential =
        config.webIntegrityMintEnabled && config.webIntegrityBearerEnabled

    const state = useMemo((): IntegrityAccessState => {
        if (!isTokenCredential) return ALWAYS_READY
        if (!snapshot)
            return hasInternet ? { status: 'pending' } : { status: 'offline' }
        return deriveIntegrityAccessState(snapshot, {
            now,
            pendingSince: pendingSince ?? now,
            isOnline: hasInternet,
            needsInteraction:
                frameUrl !== null && isFrameExpanded && !isFrameDismissed,
            isFrameDismissed: frameUrl !== null && isFrameDismissed,
            isEnrolmentDeferred,
        })
    }, [
        isTokenCredential,
        snapshot,
        now,
        pendingSince,
        hasInternet,
        frameUrl,
        isFrameExpanded,
        isFrameDismissed,
        isEnrolmentDeferred,
    ])

    const retry = useCallback(() => sendIntegrityControl({ kind: 'retry' }), [])
    const verify = useCallback(
        () => useIntegrityCheckFrameStore.getState().requestVerify(),
        [],
    )

    return { state, retry, verify }
}
