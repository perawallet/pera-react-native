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
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { PWIcon, PWTouchableOpacity, PWView } from '@components/core'
// Direct subpath, not the module barrel: the barrel deliberately excludes the
// carousel so screens that only want HomeBannersStrip don't drag it in. This
// surface genuinely renders banners, so it takes the carousel knowingly.
import { BannerCarousel } from '@modules/banners/components/BannerCarousel'
import { useBannerLinkRouter } from '@modules/banners/hooks/useBannerLinkRouter'
import type { PromptViewProps } from '@modules/prompts/models'
import { useStyles } from './styles'

export const BANNER_PROMPT_ID = 'banner_prompt'

/**
 * The banner surface, shown in the prompt overlay when a banner asks to open
 * itself. Same carousel the modal route renders for a deliberate tap on the
 * strip — a forced banner differs only in that it cannot be dismissed, not in
 * what it is.
 */
export const BannerPrompt = ({ onHide }: PromptViewProps) => {
    const insets = useSafeAreaInsets()
    const styles = useStyles(insets)
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
            routeUrl({
                url: banner.buttonUrl,
                isExternal: banner.isButtonUrlExternal,
            })
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

    if (!shown) return null

    return (
        <PWView style={styles.root}>
            <PWView style={styles.body}>
                <BannerCarousel
                    banners={banners}
                    onPressCTA={handlePressCTA}
                    onDismiss={handleDismiss}
                    isDismissable={!isForced}
                    testID={BANNER_PROMPT_ID}
                />
            </PWView>
            {/* A forced banner has no way out but its CTA — that is the point
                of forcing it. Everything else keeps the close affordance the
                carousel modal has always had. */}
            {isForced ? null : (
                <PWTouchableOpacity
                    style={styles.closeButton}
                    onPress={finish}
                    testID='banner_prompt_close'
                >
                    <PWIcon
                        name='cross'
                        size='sm'
                        variant='white'
                    />
                </PWTouchableOpacity>
            )}
        </PWView>
    )
}
