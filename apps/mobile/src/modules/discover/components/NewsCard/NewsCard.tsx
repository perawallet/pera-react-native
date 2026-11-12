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
import { PWImage, PWText, PWTouchableOpacity, PWView } from '@components/core'
import { useStyles } from './styles'

export type NewsCardProps = {
    title: string
    banner: Nullable<string>
    dateDisplay: string
    onPress: () => void
    testID?: string
}

export const NewsCard = ({
    title,
    banner,
    dateDisplay,
    onPress,
    testID,
}: NewsCardProps) => {
    const styles = useStyles()

    return (
        <PWTouchableOpacity
            style={styles.card}
            onPress={onPress}
            testID={testID}
        >
            {banner ? (
                <PWImage
                    source={{ uri: banner }}
                    style={styles.banner}
                />
            ) : (
                <PWView style={styles.banner} />
            )}
            <PWView style={styles.body}>
                <PWText
                    variant='h4'
                    numberOfLines={2}
                >
                    {title}
                </PWText>
                <PWText
                    variant='caption'
                    style={styles.date}
                >
                    {dateDisplay}
                </PWText>
            </PWView>
        </PWTouchableOpacity>
    )
}
