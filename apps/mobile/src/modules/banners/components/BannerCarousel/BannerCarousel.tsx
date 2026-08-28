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
import type { Banner } from '@perawallet/wallet-core-banners'
import { PWFlatList, PWView } from '@components/core'
import { BannerCard } from '../BannerCard'
import { BannerCarouselPage } from './BannerCarouselPage'
import { PagerDots } from './PagerDots'
import { useBannerCarousel } from './useBannerCarousel'
import { useStyles } from './styles'

export type BannerCarouselProps = {
    banners: Banner[]
    initialIndex?: number
    onPressCTA: (banner: Banner) => void
    onDismiss: (banner: Banner) => void
    isDismissable?: boolean
    testID?: string
}

const keyExtractor = (banner: Banner) => banner.id

export const BannerCarousel = ({
    banners,
    initialIndex = 0,
    onPressCTA,
    onDismiss,
    isDismissable = true,
    testID = 'banner_carousel',
}: BannerCarouselProps) => {
    const styles = useStyles()
    const { activeIndex, pageSize, handleLayout, handleMomentumScrollEnd } =
        useBannerCarousel({ initialIndex, count: banners.length })

    const renderItem = useCallback(
        ({ item }: { item: Banner }) => (
            <BannerCarouselPage
                banner={item}
                width={pageSize.width}
                height={pageSize.height}
                onPressCTA={onPressCTA}
                onDismiss={onDismiss}
                isDismissable={isDismissable}
            />
        ),
        [pageSize, onPressCTA, onDismiss, isDismissable],
    )

    if (banners.length === 0) return null

    if (banners.length === 1) {
        return (
            <PWView
                style={styles.singlePage}
                testID={testID}
            >
                <BannerCard
                    banner={banners[0]}
                    onPressCTA={onPressCTA}
                    onDismiss={onDismiss}
                    isDismissable={isDismissable}
                />
            </PWView>
        )
    }

    return (
        <PWView
            style={styles.multiBannerRoot}
            testID={testID}
        >
            {/* A paging list rather than react-native-pager-view: that library
                renders the iOS pager through SwiftUI and does not size a page to
                the pager's frame, so a full-height page is drawn offset from its
                own layout and clipped at the bottom — taking the card's CTA and
                dismiss link with it. Pages mount only once this box is measured,
                so each is exactly one viewport and initialScrollIndex lands on
                the right banner — which also means this subtree renders nothing
                under jsdom, where onLayout never fires. */}
            <PWView
                style={styles.pagerArea}
                onLayout={handleLayout}
            >
                {pageSize.width > 0 ? (
                    <PWFlatList
                        data={banners}
                        horizontal
                        pagingEnabled
                        initialScrollIndex={initialIndex}
                        keyExtractor={keyExtractor}
                        renderItem={renderItem}
                        onMomentumScrollEnd={handleMomentumScrollEnd}
                        style={styles.pager}
                    />
                ) : null}
            </PWView>
            <PagerDots
                count={banners.length}
                activeIndex={activeIndex}
            />
        </PWView>
    )
}
