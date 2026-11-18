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

import type { Nullable } from '@perawallet/wallet-core-shared'
import {
    PWIcon,
    PWImage,
    PWText,
    PWTouchableOpacity,
    PWView,
} from '@components/core'
import { useLanguage } from '@hooks/useLanguage'
import { useStyles } from './styles'

export type NewsCardProps = {
    title: string
    banner: Nullable<string>
    dateDisplay: string
    /** Left out until the card has a native destination; the card is then inert. */
    onPress?: () => void
    /** The full-width list card's "Read" cue, as the web news list. */
    showReadAction?: boolean
    /** \`plain\`: the home carousel card of the design, an image over bare text; \`card\` (default): the news list card. */
    variant?: 'card' | 'plain'
    testID?: string
}

export const NewsCard = ({
    title,
    banner,
    dateDisplay,
    onPress,
    showReadAction = false,
    variant = 'card',
    testID,
}: NewsCardProps) => {
    const styles = useStyles()
    const isPlain = variant === 'plain'
    const { t } = useLanguage()

    return (
        <PWTouchableOpacity
            style={isPlain ? undefined : styles.card}
            onPress={onPress}
            disabled={onPress === undefined}
            testID={testID}
        >
            {banner ? (
                <PWImage
                    source={{ uri: banner }}
                    style={[styles.banner, isPlain && styles.plainBanner]}
                />
            ) : (
                <PWView
                    style={[styles.banner, isPlain && styles.plainBanner]}
                />
            )}
            <PWView style={isPlain ? styles.plainBody : styles.body}>
                <PWText
                    variant={isPlain ? 'bodyLarge' : 'h4'}
                    weight={isPlain ? 500 : undefined}
                    numberOfLines={2}
                >
                    {title}
                </PWText>
                <PWView style={styles.footer}>
                    <PWText
                        variant={isPlain ? 'footnoteMedium' : 'caption'}
                        weight={isPlain ? 400 : undefined}
                        style={styles.date}
                    >
                        {dateDisplay}
                    </PWText>
                    {showReadAction ? (
                        <PWView style={styles.read}>
                            <PWText variant='captionMedium'>
                                {t('discover.news.read')}
                            </PWText>
                            <PWIcon
                                name='chevron-right'
                                size='xs'
                            />
                        </PWView>
                    ) : null}
                </PWView>
            </PWView>
        </PWTouchableOpacity>
    )
}
