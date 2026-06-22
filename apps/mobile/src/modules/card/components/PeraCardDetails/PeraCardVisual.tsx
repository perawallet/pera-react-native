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
}

export const PeraCardVisual = ({ maskedPan }: PeraCardVisualProps) => {
    const styles = useStyles()

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
