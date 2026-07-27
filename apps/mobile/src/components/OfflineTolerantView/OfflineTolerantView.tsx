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

import { type ReactNode } from 'react'
import { PWButton } from '@components/core'
import { EmptyView } from '@components/EmptyView'
import { useLanguage } from '@hooks/useLanguage'

export type OfflineTolerantViewProps = {
    /**
     * The surface has nothing to show because there is no connectivity: its
     * query is paused, or it errored on a device already known to be offline
     * (`isPaused || (isError && !hasInternet)` — see
     * `docs/OFFLINE_PAUSED_STATE.md`). Computed by the caller's hook, because
     * the honest signal is per-query, not per-device.
     */
    isOffline: boolean
    /**
     * The request failed while the device is online. Leave unset on surfaces
     * that render their own error UI — they delegate the offline arm only.
     */
    isError?: boolean
    /**
     * Retry affordance. Omit where retrying is not meaningful (e.g. a search
     * that re-runs on the next keystroke) and no button is rendered. Handlers
     * are expected to short-circuit while offline rather than dispatch a
     * doomed request.
     */
    onRetry?: () => void
    /** Retry button copy. Defaults to `common.retry.label`. */
    retryLabel?: string
    /** Replaces the generic `common.error.body` copy on the error arm. */
    errorBody?: string
    offlineTestID?: string
    errorTestID?: string
    children: ReactNode
}

/**
 * Renders the shared offline surface — and optionally the shared error surface
 * — in place of its children, so every remote-backed screen tells the same
 * story instead of hand-rolling the fork.
 *
 * It covers the middle of the PERA-4581 precedence
 * (`data → offline → error → loading → empty`): callers keep owning `data`,
 * `loading` and `empty`, which stay surface-specific, and pass whatever they
 * would have rendered as `children`.
 */
export const OfflineTolerantView = ({
    isOffline,
    isError = false,
    onRetry,
    retryLabel,
    errorBody,
    offlineTestID,
    errorTestID,
    children,
}: OfflineTolerantViewProps) => {
    const { t } = useLanguage()

    if (!isOffline && !isError) {
        return <>{children}</>
    }

    const retryButton = onRetry ? (
        <PWButton
            variant='link'
            title={retryLabel ?? t('common.retry.label')}
            onPress={onRetry}
        />
    ) : undefined

    // Offline outranks error: a failed request on a device with no
    // connectivity is the same "nothing to show yet" situation, and the
    // generic error copy would send the user chasing a fault that isn't theirs.
    if (isOffline) {
        return (
            <EmptyView
                icon='globe'
                title={t('common.offline_mode')}
                body={t('common.offline_refresh_body')}
                button={retryButton}
                testID={offlineTestID}
            />
        )
    }

    return (
        <EmptyView
            icon='info'
            title={t('common.error.title')}
            body={errorBody ?? t('common.error.body')}
            button={retryButton}
            testID={errorTestID}
        />
    )
}
