/*
 Copyright 2022-2025 Pera Wallet, LDA
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
import { usePreferences } from './usePreferences'

const TOOLTIP_SEEN_KEY_PREFIX = 'tooltip-seen:'

const buildKey = (id: string) => `${TOOLTIP_SEEN_KEY_PREFIX}${id}`

export type UseTooltipSeenResult = {
    hasSeen: (id: string) => boolean
    markSeen: (id: string) => void
    reset: (id: string) => void
}

export const useTooltipSeen = (): UseTooltipSeenResult => {
    const { hasPreference, setPreference, deletePreference } = usePreferences()

    const hasSeen = useCallback(
        (id: string) => hasPreference(buildKey(id)),
        [hasPreference],
    )

    const markSeen = useCallback(
        (id: string) => setPreference(buildKey(id), true),
        [setPreference],
    )

    const reset = useCallback(
        (id: string) => deletePreference(buildKey(id)),
        [deletePreference],
    )

    return { hasSeen, markSeen, reset }
}
