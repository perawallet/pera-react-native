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

import { PWIcon, PWImage, PWView } from '@components/core'
import peraCardSmall from '@assets/images/pera-card-small.png'
import { useStyles } from './styles'

type FrozenCardGlyphProps = {
    /** `sm` for the inline banner, `lg` for the bottom sheet. */
    size: 'sm' | 'lg'
    testID?: string
}

/**
 * The Pera card art with an orange pause badge in the lower-right — the "frozen"
 * indicator used by both the Card Frozen banner and the freeze confirmation sheet.
 */
export const FrozenCardGlyph = ({ size, testID }: FrozenCardGlyphProps) => {
    const styles = useStyles({ size })

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
                    name='pause'
                    size={size === 'lg' ? 'sm' : 'xs'}
                    variant='white'
                />
            </PWView>
        </PWView>
    )
}
