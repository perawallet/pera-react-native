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

import type { SpotBanner } from '@perawallet/wallet-core-banners'
import {
    PWImage,
    PWText,
    PWTouchableIcon,
    PWTouchableOpacity,
    PWView,
} from '@components/core'
import { useStyles } from './styles'

export type SpotBannerCardProps = {
    banner: SpotBanner
    onPress: (banner: SpotBanner) => void
    onDismiss: (banner: SpotBanner) => void
    testID?: string
}

export const SpotBannerCard = ({
    banner,
    onPress,
    onDismiss,
    testID = 'spot_banner_card',
}: SpotBannerCardProps) => {
    const styles = useStyles()
    return (
        <PWView
            style={styles.page}
            testID={testID}
        >
            <PWTouchableOpacity
                style={styles.card}
                onPress={() => onPress(banner)}
                testID={`${testID}_press`}
            >
                <PWView style={styles.iconWrapper}>
                    <PWImage
                        source={{ uri: banner.imageUrl }}
                        style={styles.icon}
                        resizeMode='cover'
                    />
                </PWView>
                <PWText
                    style={styles.text}
                    numberOfLines={2}
                >
                    {banner.text}
                </PWText>
                <PWTouchableIcon
                    name='cross'
                    size='sm'
                    variant='secondary'
                    onPress={() => onDismiss(banner)}
                    containerStyle={styles.dismissButton}
                    testID={`${testID}_dismiss`}
                />
            </PWTouchableOpacity>
        </PWView>
    )
}
