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

import type { Banner } from '@perawallet/wallet-core-banners'
import {
    PWImage,
    PWScrollView,
    PWText,
    PWTouchableOpacity,
    PWView,
} from '@components/core'
import { useLanguage } from '@hooks/useLanguage'
import { BannerIcon } from '../BannerIcon'
import { getBannerBackgroundSource } from './bannerBackgrounds'
import { useStyles } from './styles'

export type BannerCardProps = {
    banner: Banner
    onPressCTA: (banner: Banner) => void
    onDismiss: (banner: Banner) => void
    // `false` for forced banners — hides the dismiss link entirely.
    isDismissable?: boolean
    testID?: string
}

export const BannerCard = ({
    banner,
    onPressCTA,
    onDismiss,
    isDismissable = true,
    testID = 'banner_card',
}: BannerCardProps) => {
    const styles = useStyles()
    const { t } = useLanguage()

    const hasCTA = Boolean(banner.buttonLabel && banner.buttonUrl)
    const backgroundSource = getBannerBackgroundSource(banner)

    return (
        <PWView
            style={styles.container}
            testID={testID}
        >
            <PWView style={styles.imageHalf}>
                <PWImage
                    source={backgroundSource}
                    style={styles.backgroundImage}
                    resizeMode='cover'
                />
            </PWView>

            <PWView style={styles.contentHalf}>
                <PWScrollView
                    style={styles.scrollArea}
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                >
                    <PWView style={styles.topGroup}>
                        <PWView style={styles.iconBubble}>
                            <BannerIcon
                                type={banner.type}
                                size='md'
                                variant='banner'
                            />
                        </PWView>
                        {banner.title ? (
                            <PWText style={styles.title}>{banner.title}</PWText>
                        ) : null}
                    </PWView>
                    {banner.subtitle ? (
                        <PWText style={styles.subtitle}>
                            {banner.subtitle}
                        </PWText>
                    ) : null}
                </PWScrollView>

                <PWView style={styles.bottomGroup}>
                    {hasCTA ? (
                        <PWTouchableOpacity
                            style={styles.cta}
                            onPress={() => onPressCTA(banner)}
                            testID={`${testID}_cta`}
                        >
                            <PWText style={styles.ctaText}>
                                {banner.buttonLabel}
                            </PWText>
                        </PWTouchableOpacity>
                    ) : null}

                    {isDismissable ? (
                        <PWTouchableOpacity
                            style={styles.dismissLink}
                            onPress={() => onDismiss(banner)}
                            testID={`${testID}_dismiss`}
                        >
                            <PWText style={styles.dismissLinkText}>
                                {t('banners.dismiss')}
                            </PWText>
                        </PWTouchableOpacity>
                    ) : null}
                </PWView>
            </PWView>
        </PWView>
    )
}
