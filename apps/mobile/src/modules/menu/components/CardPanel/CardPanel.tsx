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

import { PWButton } from '@components/PWButton'
import { PWView } from '@components/PWView'
import { Image, Text } from '@rneui/themed'
import { useStyles } from './styles'
import { PWIcon } from '@components/PWIcon'
import { useLanguage } from '@hooks/language'

import CardBackground from '@assets/images/card-background.png'
const BACKGROUND_URI = Image.resolveAssetSource(CardBackground).uri

export const CardPanel = () => {
    const styles = useStyles()
    const { t } = useLanguage()
    return (
        <PWView style={styles.cardContainer}>
            <PWView style={styles.cardHeaderContainer}>
                <PWView style={styles.cardTextContainer}>
                    <PWView style={styles.titleContainer}>
                        <PWIcon
                            name='card'
                            style={styles.icon}
                        />
                        <Text h3>{t('menu.cards')}</Text>
                    </PWView>
                    <Text style={styles.cardSecondaryText}>
                        Get the world{`'`}s first web3{'\n'}Mastercard.
                    </Text>
                </PWView>
                <PWView style={styles.cardImageContainer}>
                    <Image
                        source={{ uri: BACKGROUND_URI }}
                        style={styles.backgroundImage}
                    />
                </PWView>
            </PWView>
            <PWView style={styles.cardButtonContainer}>
                <PWButton
                    variant='primary'
                    title={'Create Pera Card'}
                    icon='plus'
                />
            </PWView>
        </PWView>
    )
}
