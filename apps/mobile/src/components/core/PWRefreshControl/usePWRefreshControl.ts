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
import { useToast } from '@hooks/useToast'
import { useLanguage } from '@hooks/useLanguage'
import { useNetworkStatus } from '@modules/network'

type UsePWRefreshControlParams = {
    onRefresh: () => void
}

type UsePWRefreshControlResult = {
    handleRefresh: () => void
}

export const usePWRefreshControl = ({
    onRefresh,
}: UsePWRefreshControlParams): UsePWRefreshControlResult => {
    const { hasInternet } = useNetworkStatus()
    const { showToast } = useToast()
    const { t } = useLanguage()

    const handleRefresh = useCallback(() => {
        // An offline refetch just parks as a paused query — the spinner
        // dismisses instantly with no data change and no feedback. Give the
        // pull an explicit answer instead of a silent no-op.
        if (!hasInternet) {
            showToast({
                title: t('common.offline_mode'),
                body: t('common.offline_refresh_body'),
                type: 'info',
            })
            return
        }
        onRefresh()
    }, [hasInternet, onRefresh, showToast, t])

    return { handleRefresh }
}
