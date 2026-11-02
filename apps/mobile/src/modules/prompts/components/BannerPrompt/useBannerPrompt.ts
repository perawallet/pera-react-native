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

import { useCallback, useEffect } from 'react'
import {
    useBannersStore,
    useVisibleBanners,
    type Banner,
} from '@perawallet/wallet-core-banners'
import type { Optional } from '@perawallet/wallet-core-shared'
import { useBannerLinkRouter } from '@modules/banners'
import type { PromptViewProps } from '@modules/prompts/models'

export const BANNER_PROMPT_ID = 'banner_prompt'

export type UseBannerPromptResult = {
    banners: Banner[]
    isForced: boolean
    shown: Optional<Banner>
    finish: () => void
    handlePressCTA: (banner: Banner) => void
    handleDismiss: (banner: Banner) => void
}

export const useBannerPrompt = ({
    onHide,
}: Pick<PromptViewProps, 'onHide'>): UseBannerPromptResult => {
    const { banners, forcedBanner } = useVisibleBanners()
    const dismissBanner = useBannersStore(state => state.dismissBanner)
    const markAutoOpened = useBannersStore(state => state.markAutoOpened)
    const { route: routeUrl } = useBannerLinkRouter()

    const isForced = forcedBanner !== null
    const shown = banners[0]

    // Marked when the banner is answered, never on mount. useBannerPrompt reads
    // this flag to decide the prompt is due, so marking on mount made the
    // prompt un-due the instant it appeared and it unmounted itself.
    const finish = useCallback(() => {
        if (shown) markAutoOpened(shown.id)
        onHide(BANNER_PROMPT_ID)
    }, [shown, markAutoOpened, onHide])

    const handlePressCTA = useCallback(
        (banner: Banner) => {
            // Release the overlay first: it paints above the navigator, so a
            // CTA that deep-links would otherwise land behind it.
            finish()
            routeUrl({ url: banner.buttonUrl })
        },
        [finish, routeUrl],
    )

    const handleDismiss = useCallback(
        (banner: Banner) => {
            if (isForced) return
            dismissBanner(banner.id)
            finish()
        },
        [dismissBanner, isForced, finish],
    )

    // The queue only raises this prompt while a banner is due, but the set can
    // empty underneath it (a refetch dropping the banner); leave rather than
    // hold an empty overlay up.
    useEffect(() => {
        if (!shown) finish()
    }, [shown, finish])

    return {
        banners,
        isForced,
        shown,
        finish,
        handlePressCTA,
        handleDismiss,
    }
}
