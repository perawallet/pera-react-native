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

import { useCallback, useRef, useState } from 'react'
import { getSyncService } from '@perawallet/wallet-core-background'
import { useNetwork } from '@perawallet/wallet-core-blockchain'
import { useIsMounted } from '@hooks/useIsMounted'

type UseSyncRefreshParams = {
    addresses: string[]
}

export type UseSyncRefreshResult = {
    isRefreshing: boolean
    refresh: () => void
}

/**
 * Pull-to-refresh for DB-first screens. Their queries hold
 * `staleTime: Infinity` over SQLite, so `refetch()` only re-reads the same
 * local rows — only the sync service pulls fresh chain state, persists it,
 * and then invalidates.
 *
 * No connectivity gate here: PWRefreshControl short-circuits offline pulls
 * (pulsing the offline banner) before `onRefresh` ever fires.
 */
export const useSyncRefresh = ({
    addresses,
}: UseSyncRefreshParams): UseSyncRefreshResult => {
    const { network } = useNetwork()
    const isMounted = useIsMounted()
    const [isRefreshing, setIsRefreshing] = useState(false)
    // A ref, not isRefreshing: the state this callback closes over is the value
    // captured when it was created, so it can't see a refresh started since.
    const isInFlightRef = useRef(false)

    const refresh = useCallback(() => {
        if (isInFlightRef.current) return

        isInFlightRef.current = true
        setIsRefreshing(true)
        void (async () => {
            try {
                const syncService = getSyncService()
                await syncService.refreshAccounts(addresses, network)
                syncService.invalidateQueries()
            } catch {
                // Chiefly getSyncService() before init, but a pull gesture must
                // never surface a crash — the periodic tick is the safety net.
            } finally {
                isInFlightRef.current = false
                if (isMounted()) setIsRefreshing(false)
            }
        })()
    }, [addresses, isMounted, network])

    return { isRefreshing, refresh }
}
