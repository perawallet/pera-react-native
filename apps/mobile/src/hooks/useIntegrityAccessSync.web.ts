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

import { useEffect, useRef } from 'react'
import { config } from '@perawallet/wallet-core-config'
import {
    getValidIntegrityToken,
    useAppIntegrityStore,
} from '@perawallet/wallet-core-app-integrity'
import {
    deriveIntegrityAccessState,
    onIntegritySnapshotChanged,
    readIntegritySnapshot,
    sendIntegrityControl,
} from '@perawallet/wallet-core-browser-runtime'
import {
    isIntegrityRequiredError,
    logger,
    setIntegrityTokenWaiter,
    setOnIntegrityRefused,
} from '@perawallet/wallet-core-shared'
import { queryClient } from '@providers/queryClient'
import {
    useNetworkStatus,
    useNetworkStatusStore,
} from './useNetworkStatusStore'
import {
    nextIntegrityDerivationAt,
    useIntegrityAccessStore,
} from './useIntegrityAccessStore.web'
import { useIntegrityFeedbackStore } from './useIntegrityFeedbackStore'

/** How long a guarded request holds for a token the worker is still fetching. */
const TOKEN_WAIT_MS = 3000

// Only while a token is on its way: after an outage is known, waiting just
// delays the refusal the surface will show anyway.
const isTokenOnItsWay = (): boolean => {
    const { snapshot, pendingSince } = useIntegrityAccessStore.getState()
    if (!snapshot) return true
    const now = Date.now()
    const { status } = deriveIntegrityAccessState(snapshot, {
        now,
        pendingSince: pendingSince ?? now,
        isOnline: useNetworkStatusStore.getState().hasInternet,
        needsInteraction: false,
        isFrameDismissed: false,
        isEnrolmentDeferred: false,
    })
    return status === 'pending' || status === 'checking'
}

// Watches the store the bearer is read from, so a request never goes out one
// tick before the token it waited for is visible to it.
const waitForToken = (): Promise<void> =>
    new Promise(resolve => {
        if (getValidIntegrityToken() !== null || !isTokenOnItsWay()) {
            resolve()
            return
        }
        const unsubscribe = useAppIntegrityStore.subscribe(() => {
            if (getValidIntegrityToken() !== null) finish()
        })
        const timer = setTimeout(finish, TOKEN_WAIT_MS)
        // Both are set before either can call this: a store change is never
        // delivered synchronously from subscribe.
        function finish(): void {
            clearTimeout(timer)
            unsubscribe()
            resolve()
        }
    })

const hasLiveToken = (): boolean => {
    const { snapshot } = useIntegrityAccessStore.getState()
    return (
        snapshot?.tokenExpiresAt != null && snapshot.tokenExpiresAt > Date.now()
    )
}

/**
 * Mirrors the service worker's integrity facts into this realm and wires the
 * request layer to them. Mounted once from AppShell.web beside
 * useIntegrityTokenSync; the worker stays the only writer of every fact.
 */
export const useIntegrityAccessSync = (): void => {
    const isTokenCredential =
        config.webIntegrityMintEnabled && config.webIntegrityBearerEnabled
    const snapshot = useIntegrityAccessStore(state => state.snapshot)
    const now = useIntegrityAccessStore(state => state.now)
    const pendingSince = useIntegrityAccessStore(state => state.pendingSince)
    const readyEpoch = useIntegrityAccessStore(state => state.readyEpoch)
    const { hasInternet } = useNetworkStatus()
    const wasOnline = useRef(hasInternet)

    useEffect(() => {
        if (!isTokenCredential) return
        let isActive = true
        const refresh = async (): Promise<void> => {
            try {
                const next = await readIntegritySnapshot()
                if (isActive) {
                    useIntegrityAccessStore
                        .getState()
                        .applySnapshot(next, Date.now())
                }
            } catch (error) {
                logger.warn('Reading the integrity facts failed', { error })
            }
        }
        void refresh().then(() => {
            // Page open: the worker's own alarm may be minutes away.
            if (isActive && !hasLiveToken()) {
                sendIntegrityControl({ kind: 'retry', soft: true })
            }
        })
        const unsubscribe = onIntegritySnapshotChanged(() => {
            void refresh()
        })
        return () => {
            isActive = false
            unsubscribe()
        }
    }, [isTokenCredential])

    useEffect(() => {
        if (!isTokenCredential || !snapshot) return
        const dueAt = nextIntegrityDerivationAt(snapshot, pendingSince, now)
        if (dueAt === null) return
        const timer = setTimeout(
            () => useIntegrityAccessStore.getState().tick(Date.now()),
            Math.max(0, dueAt - Date.now()),
        )
        return () => clearTimeout(timer)
    }, [isTokenCredential, snapshot, pendingSince, now])

    useEffect(() => {
        const cameOnline = !wasOnline.current && hasInternet
        wasOnline.current = hasInternet
        // Mints that failed while offline cost no backoff, so the first one
        // back online need not wait for the worker's alarm.
        if (isTokenCredential && cameOnline) {
            sendIntegrityControl({ kind: 'retry', soft: true })
        }
    }, [isTokenCredential, hasInternet])

    useEffect(() => {
        if (!isTokenCredential) return
        setIntegrityTokenWaiter(waitForToken)
        const unsubscribe = setOnIntegrityRefused(error => {
            useIntegrityFeedbackStore.getState().emphasizeIntegrityStatus()
            if (error.hadToken) {
                sendIntegrityControl({
                    kind: 'token-rejected',
                    tokenExpiresAt: error.tokenExpiresAt,
                })
            }
        })
        return () => {
            setIntegrityTokenWaiter(null)
            unsubscribe()
        }
    }, [isTokenCredential])

    useEffect(() => {
        if (readyEpoch === 0) return
        void queryClient.invalidateQueries({
            predicate: query => isIntegrityRequiredError(query.state.error),
        })
    }, [readyEpoch])
}
