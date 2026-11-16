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

import { useMemo } from 'react'
import type { ChainNoticeAction } from '@components/ChainNotice'
import { useNetworkStatus } from '@modules/network'

export type UseHistoryFailedNoticeParams = {
    networkNames: string[]
    /** False on a network without the service: a retry can only fail again. */
    isRetryable: boolean
    onRetry: () => void
}

export type UseHistoryFailedNoticeResult = {
    isVisible: boolean
    params: { networks: string }
    action?: ChainNoticeAction
}

// Offline every read fails, and the app's offline banner already says so.
export const useHistoryFailedNotice = ({
    networkNames,
    isRetryable,
    onRetry,
}: UseHistoryFailedNoticeParams): UseHistoryFailedNoticeResult => {
    const { hasInternet } = useNetworkStatus()
    const params = useMemo(
        () => ({ networks: networkNames.join(', ') }),
        [networkNames],
    )
    const action = useMemo(
        () =>
            isRetryable
                ? { labelKey: 'common.retry.label', onPress: onRetry }
                : undefined,
        [isRetryable, onRetry],
    )

    return {
        isVisible: hasInternet && networkNames.length > 0,
        params,
        action,
    }
}
