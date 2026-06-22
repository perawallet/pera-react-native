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

import { PWIcon, PWImage, PWText, PWView } from '@components/core'
import peraCardImage from '@assets/images/pera-card.png'
import { useLanguage } from '@hooks/useLanguage'
import { useStyles } from './styles'

type PeraCardAccountHeaderProps = {
    linkedLabel: string
    onMore: () => void
    onScan: () => void
    onInbox: () => void
}

export const PeraCardAccountHeader = ({
    linkedLabel,
    onMore,
    onScan,
    onInbox,
}: PeraCardAccountHeaderProps) => {
    const { t } = useLanguage()
    const styles = useStyles()

    return (
        <PWView style={styles.header}>
            <PWView style={styles.headerLeft}>
                <PWImage
                    source={peraCardImage}
                    style={styles.cardThumb}
                    resizeMode='cover'
                />
                <PWView style={styles.headerTitleBlock}>
                    <PWView style={styles.headerTitleRow}>
                        <PWText
                            variant='h3'
                            weight={600}
                            numberOfLines={1}
                        >
                            {t('peraCard.account.navigation_title')}
                        </PWText>
                        <PWIcon
                            name='chevron-down'
                            size='sm'
                            variant='secondary'
                        />
                    </PWView>
                    <PWText
                        variant='footnoteMedium'
                        weight={400}
                        style={styles.headerSubtitle}
                        numberOfLines={1}
                    >
                        {linkedLabel}
                    </PWText>
                </PWView>
            </PWView>

            <PWView style={styles.headerRight}>
                <PWIcon
                    name='ellipsis'
                    onPress={onMore}
                    testID='pera_card_account_more_button'
                />
                <PWIcon
                    name='camera'
                    onPress={onScan}
                    testID='pera_card_account_scan_button'
                />
                <PWIcon
                    name='inbox'
                    onPress={onInbox}
                    testID='pera_card_account_inbox_button'
                />
            </PWView>
        </PWView>
    )
}
