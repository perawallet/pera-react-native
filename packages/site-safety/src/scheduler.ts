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

import { onlineManager } from '@tanstack/react-query'
import { logger } from '@perawallet/wallet-core-shared'
import { PHISHING_LIST_REFRESH_AGE_MS, refreshPhishingLists } from './refresh'
import { ensurePhishingListsSeeded } from './seed'
import { PHISHING_LIST_SOURCES } from './sources'
import { usePhishingListStore } from './store/store'

export const PHISHING_LIST_CHECK_INTERVAL_MS = 60 * 60 * 1000

const isAnySourceDue = (now: number): boolean => {
    const { sources } = usePhishingListStore.getState()
    return PHISHING_LIST_SOURCES.some(
        ({ id }) =>
            now - (sources[id]?.refreshedAt ?? 0) >=
            PHISHING_LIST_REFRESH_AGE_MS,
    )
}

/**
 * Seeds, then keeps the lists fresh: checked now, hourly, and on every return
 * online. Run it in one long-lived context per device. Returns stop.
 */
export const startPhishingListRefresh = (): (() => void) => {
    let isStopped = false
    let running: Promise<void> | null = null

    const check = (): void => {
        if (isStopped || running) return
        running = (async () => {
            await ensurePhishingListsSeeded()
            if (isStopped || !onlineManager.isOnline()) return
            if (isAnySourceDue(Date.now())) await refreshPhishingLists()
        })()
            .catch(error => {
                logger.warn('[site-safety] phishing list check failed', {
                    error,
                })
            })
            .finally(() => {
                running = null
            })
    }

    check()
    const timer = setInterval(check, PHISHING_LIST_CHECK_INTERVAL_MS)
    const unsubscribe = onlineManager.subscribe(isOnline => {
        if (isOnline) check()
    })

    return () => {
        isStopped = true
        clearInterval(timer)
        unsubscribe()
    }
}
