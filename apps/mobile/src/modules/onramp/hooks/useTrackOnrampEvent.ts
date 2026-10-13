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
import {
    AnalyticsMetadataKey,
    trackEvent,
    type OnrampEvent,
} from '@analytics'
import { useOnrampAccount } from './useOnrampAccount'

/** Tracks an onramp event with the chain Fund is buying onto; nothing while there is none. */
export const useTrackOnrampEvent = (): ((event: OnrampEvent) => void) => {
    const chainId = useOnrampAccount().scope?.chainId ?? null

    return useCallback(
        (event: OnrampEvent) => {
            if (chainId === null) return
            trackEvent(event, { [AnalyticsMetadataKey.ChainId]: chainId })
        },
        [chainId],
    )
}
