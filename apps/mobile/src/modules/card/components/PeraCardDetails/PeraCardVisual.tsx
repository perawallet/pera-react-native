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

import { PWImage, PWText, PWView } from '@components/core'
import peraCardImage from '@assets/images/pera-card.png'
import { useStyles } from './styles'

type PeraCardVisualProps = {
    /** Already-masked PAN, e.g. "•••• 2234". */
    maskedPan: string
    /**
     * Single-use secure-view image URL (PAN/CVC/expiry rendered server-side).
     * When set, it replaces the masked brand art; raw values never reach us.
     */
    secureImageUrl?: string
    /** Called when the secure image fails to load (expired URL, network). */
    onSecureImageError?: () => void
}

export const PeraCardVisual = ({
    maskedPan,
    secureImageUrl,
    onSecureImageError,
}: PeraCardVisualProps) => {
    const styles = useStyles()

    if (secureImageUrl != null) {
        return (
            <PWView style={styles.cardContainer}>
                {/* `contain` so the server-rendered PAN/CVC/expiry can never be
                    cropped, even if its aspect ratio differs from the box. */}
                <PWImage
                    source={{ uri: secureImageUrl }}
                    style={styles.cardImage}
                    resizeMode='contain'
                    onError={onSecureImageError}
                />
            </PWView>
        )
    }

    return (
        <PWView style={styles.cardContainer}>
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
        </PWView>
    )
}
