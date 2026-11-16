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

import { useCallback, useEffect, useRef, useState } from 'react'
import { config } from '@perawallet/wallet-core-config'
import {
    AnalyticsMetadataKey as Key,
    DiscoverEvent,
    trackEvent,
    type LegacyImportFailureReason,
} from '@analytics'
import { isTrustedWebviewOrigin } from '@modules/webview'
import { useDiscoverFavoritesStore } from '../store/useDiscoverFavoritesStore'
import { parseLegacyFavoritesMessage } from '../utils/legacyFavorites'
import { dappsByNormalizedUrl } from '../utils/toDiscoverDapp'
import { useDiscoverDirectory } from './useDiscoverDirectory'

// lanekeep-ignore-next-line pera/no-numeric-sizes reason: a duration in ms, not a size
export const LEGACY_IMPORT_TIMEOUT_MS = 10_000

// One attempt per app launch, however often the home mounts: a failed or
// abandoned attempt waits for the next launch, as the design asks.
let attemptStarted = false

/** Test seam only: forgets this launch's attempt. */
export const resetLegacyImportAttemptForTests = (): void => {
    attemptStarted = false
}

type Phase = 'idle' | 'running' | 'ended'

export type UseLegacyFavoritesImportResult = {
    /** Mount the hidden reader while true. */
    isActive: boolean
    onMessage: (url: string, data: unknown) => void
    onFailure: (reason: 'load_error' | 'http_error') => void
}

/**
 * Copies the legacy WebView Discover's favorites into the store once. Waits for
 * the directory so chains can be filled; the first outcome of an attempt wins.
 */
export const useLegacyFavoritesImport = (): UseLegacyFavoritesImportResult => {
    const status = useDiscoverFavoritesStore(s => s.legacyImport.status)
    const { projects, isLoading } = useDiscoverDirectory()
    const [phase, setPhase] = useState<Phase>(() =>
        attemptStarted ? 'ended' : 'idle',
    )
    const endedRef = useRef(false)
    const projectsRef = useRef(projects)
    projectsRef.current = projects

    const canStart = status === 'pending' && !isLoading && phase === 'idle'
    useEffect(() => {
        if (!canStart || attemptStarted) return
        attemptStarted = true
        setPhase('running')
    }, [canStart])

    const end = useCallback((): boolean => {
        if (endedRef.current) return false
        endedRef.current = true
        setPhase('ended')
        return true
    }, [])

    const fail = useCallback(
        (reason: LegacyImportFailureReason) => {
            if (!end()) return
            const store = useDiscoverFavoritesStore.getState()
            if (store.recordLegacyImportFailure() === 'gave_up') {
                trackEvent(DiscoverEvent.LegacyFavoritesImportFailed, {
                    [Key.AttemptCount]:
                        useDiscoverFavoritesStore.getState().legacyImport
                            .attempts,
                    [Key.FailureReason]: reason,
                })
            }
        },
        [end],
    )

    useEffect(() => {
        if (phase !== 'running') return
        const timer = setTimeout(
            () => fail('timeout'),
            LEGACY_IMPORT_TIMEOUT_MS,
        )
        return () => clearTimeout(timer)
    }, [phase, fail])

    const onMessage = useCallback(
        (url: string, data: unknown) => {
            if (endedRef.current) return
            if (!isTrustedWebviewOrigin(url, [config.discoverBaseUrl])) {
                fail('untrusted_origin')
                return
            }
            const parsed = parseLegacyFavoritesMessage(data)
            if (parsed === null) {
                fail('malformed')
                return
            }
            if (!end()) return
            const result = useDiscoverFavoritesStore
                .getState()
                .importLegacyFavorites(
                    parsed.entries,
                    dappsByNormalizedUrl(projectsRef.current),
                )
            trackEvent(DiscoverEvent.LegacyFavoritesImported, {
                [Key.ImportedCount]: result.imported,
                [Key.SkippedCount]: parsed.skipped,
                [Key.AlreadyFavoriteCount]: result.alreadyFavorite,
            })
        },
        [end, fail],
    )

    return { isActive: phase === 'running', onMessage, onFailure: fail }
}
