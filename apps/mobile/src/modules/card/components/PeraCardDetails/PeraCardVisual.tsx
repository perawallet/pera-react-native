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

import Animated from 'react-native-reanimated'
import { PWImage, PWText, PWView } from '@components/core'
import peraCardImage from '@assets/images/pera-card.png'
import { usePeraCardVisual } from './usePeraCardVisual'
import { useStyles } from './styles'

type PeraCardVisualProps = {
    /** Already-masked PAN, e.g. "•••• 2234". */
    maskedPan: string
    /**
     * Secure-view image URL (PAN/CVC/expiry rendered server-side). Cached for
     * the screen visit, so it stays set across hide; raw values never reach us.
     */
    secureImageUrl?: string
    /** Whether the card should be flipped open to the secure face. */
    isOpen?: boolean
    /** Grays the card art out while the Baanx card doesn't exist yet. */
    isDimmed?: boolean
    /** Called when the secure image has rendered (ends the reveal state). */
    onSecureImageLoad?: () => void
    /** Called when the secure image fails to load (expired URL, network). */
    onSecureImageError?: () => void
}

export const PeraCardVisual = ({
    maskedPan,
    secureImageUrl,
    isOpen,
    isDimmed = false,
    onSecureImageLoad,
    onSecureImageError,
}: PeraCardVisualProps) => {
    const styles = useStyles()
    const {
        backImageUrl,
        frontAnimatedStyle,
        backAnimatedStyle,
        onBackImageLoad,
    } = usePeraCardVisual({ secureImageUrl, isOpen, onSecureImageLoad })

    return (
        <PWView style={[styles.cardContainer, isDimmed && styles.disabled]}>
            {/* Front (masked) face — rotates away as the card flips open. */}
            <Animated.View style={[styles.cardFace, frontAnimatedStyle]}>
                <PWImage
                    source={peraCardImage}
                    style={styles.cardImage}
                    resizeMode='cover'
                />
                <PWView style={styles.panContainer}>
                    <PWText
                        variant='bodyLarge'
                        weight={600}
                        style={styles.pan}
                    >
                        {maskedPan}
                    </PWText>
                </PWView>
            </Animated.View>
            {backImageUrl != null && (
                /* Back (secure) face — rotates in once loaded. `contain` so the
                   server-rendered PAN/CVC/expiry can never be cropped; `none`
                   so it is never written to the on-disk image cache. No spinner
                   or transition on the card — the reveal button owns pending. */
                <Animated.View style={[styles.cardFace, backAnimatedStyle]}>
                    <PWImage
                        source={{ uri: backImageUrl }}
                        style={styles.cardImage}
                        resizeMode='contain'
                        cachePolicy='none'
                        transition={false}
                        showLoadingIndicator={false}
                        onLoad={onBackImageLoad}
                        onError={onSecureImageError}
                    />
                </Animated.View>
            )}
        </PWView>
    )
}
