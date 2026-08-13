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
import {
    useBannersStore,
    useVisibleBanners,
} from '@perawallet/wallet-core-banners'

export type UseBannerPromptResult = {
    /** A banner wants to open itself and has not had its turn this session. */
    isDue: boolean
    /**
     * The server flagged it `force`, which may mean a forced update notice — so
     * it ranks above every nudge and blocks sheet presentation like the terms
     * gate does. A `select` banner is the same surface with softer rules.
     */
    isForced: boolean
}

/**
 * Whether the banner surface is waiting for a turn in the prompt queue.
 *
 * Banners used to open themselves: an effect in HomeBannersStrip navigated to
 * the carousel modal the moment they loaded, with no idea a terms gate might be
 * up. Ordering is the queue's job now, so this only reports readiness.
 *
 * `autoOpenedBannerIds` is read as an array rather than through the store's
 * `hasAutoOpened` getter: the getter closes over the state it was built with,
 * so a memo depending on it would not re-evaluate when a banner is marked.
 */
export const useBannerPrompt = (): UseBannerPromptResult => {
    const { banners, forcedBanner } = useVisibleBanners()
    const autoOpenedBannerIds = useBannersStore(
        state => state.autoOpenedBannerIds,
    )

    return useMemo(() => {
        // A forced banner already narrows the visible set to itself, so the
        // `select` lookup only ever resolves when none is outstanding.
        const candidate =
            forcedBanner ??
            banners.find(banner => banner.autoOpenMode === 'select') ??
            null

        return {
            isDue: !!candidate && !autoOpenedBannerIds.includes(candidate.id),
            isForced: !!forcedBanner,
        }
    }, [banners, forcedBanner, autoOpenedBannerIds])
}
