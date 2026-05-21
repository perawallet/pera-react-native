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

import { useState } from 'react'
import PagerView from 'react-native-pager-view'
import type { SpotBanner } from '@perawallet/wallet-core-banners'
import { PWView } from '@components/core'
import { SpotBannerCard } from './SpotBannerCard'
import { useStyles } from './styles'

export type SpotBannerCarouselProps = {
    banners: SpotBanner[]
    onPress: (banner: SpotBanner) => void
    onDismiss: (banner: SpotBanner) => void
    testID?: string
}

export const SpotBannerCarousel = ({
    banners,
    onPress,
    onDismiss,
    testID = 'spot_banner_carousel',
}: SpotBannerCarouselProps) => {
    const styles = useStyles()
    const [activeIndex, setActiveIndex] = useState(0)

    if (banners.length === 0) return null

    if (banners.length === 1) {
        return (
            <PWView testID={testID}>
                <PWView style={styles.pager}>
                    <SpotBannerCard
                        banner={banners[0]}
                        onPress={onPress}
                        onDismiss={onDismiss}
                    />
                </PWView>
            </PWView>
        )
    }

    return (
        <PWView testID={testID}>
            <PagerView
                style={styles.pager}
                onPageSelected={e => setActiveIndex(e.nativeEvent.position)}
            >
                {banners.map(banner => (
                    <PWView key={banner.id}>
                        <SpotBannerCard
                            banner={banner}
                            onPress={onPress}
                            onDismiss={onDismiss}
                        />
                    </PWView>
                ))}
            </PagerView>
            <PWView
                style={styles.dotsContainer}
                testID={`${testID}_dots`}
            >
                {banners.map((b, i) => (
                    <PWView
                        key={b.id}
                        style={[
                            styles.dot,
                            i === activeIndex && styles.dotActive,
                        ]}
                    />
                ))}
            </PWView>
        </PWView>
    )
}
