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
import { useNetworkStatus, useOfflineFeedbackStore } from '@modules/network'

type UsePWRefreshControlParams = {
    isRefreshing: boolean
    onRefresh: () => void
}

type UsePWRefreshControlResult = {
    isRefreshing: boolean
    handleRefresh: () => void
}

export const usePWRefreshControl = ({
    isRefreshing,
    onRefresh,
}: UsePWRefreshControlParams): UsePWRefreshControlResult => {
    const { hasInternet } = useNetworkStatus()
    const emphasizeOfflineStatus = useOfflineFeedbackStore(
        state => state.emphasizeOfflineStatus,
    )

    const handleRefresh = useCallback(() => {
        if (!hasInternet) {
            // Never dispatch a doomed request, but never no-op silently either:
            // the banner pulse is the answer to the pull (docs/OFFLINE_PAUSED_STATE.md).
            emphasizeOfflineStatus()
            return
        }

        onRefresh()
    }, [emphasizeOfflineStatus, hasInternet, onRefresh])

    return {
        // Gated on connectivity so the spinner can't stick if the link drops mid-refresh.
        isRefreshing: hasInternet && isRefreshing,
        handleRefresh,
    }
}
