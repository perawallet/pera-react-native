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

import { PWIcon, PWImage, PWView } from '@components/core'
import peraCardSmall from '@assets/images/pera-card-small.png'
import { useStyles } from './styles'

/** The status a badge conveys via its colour and icon: `frozen` (orange pause)
 * and `suspicious` (red pause) both freeze the card; `unfreeze` (orange play)
 * is the resume affordance shown when the card is already frozen. */
export type CardBadge = 'frozen' | 'suspicious' | 'unfreeze'

type CardBadgeGlyphProps = {
    /** `sm` for the inline banner, `lg` for the bottom sheet. */
    size: 'sm' | 'lg'
    /** Which status badge to overlay; defaults to `frozen`. */
    badge?: CardBadge
    testID?: string
}

/**
 * The Pera card art with a status badge in the lower-right — a pause icon for
 * freezing (orange for a frozen card, red for the suspicious-activity report)
 * and a play icon for unfreezing (orange).
 */
export const CardBadgeGlyph = ({
    size,
    badge = 'frozen',
    testID,
}: CardBadgeGlyphProps) => {
    const styles = useStyles({ size, badge })
    // Unfreezing resumes the card, so it reads as "play"; freezing reads as "pause".
    const iconName = badge === 'unfreeze' ? 'play' : 'pause'

    return (
        <PWView
            style={styles.container}
            testID={testID}
        >
            <PWImage
                source={peraCardSmall}
                style={styles.card}
                resizeMode='contain'
            />
            <PWView style={styles.badge}>
                <PWIcon
                    name={iconName}
                    size={size === 'lg' ? 'sm' : 'xs'}
                    variant='white'
                />
            </PWView>
        </PWView>
    )
}
