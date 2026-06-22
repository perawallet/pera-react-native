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

import { PWIcon, PWText, PWTouchableOpacity, PWView } from '@components/core'
import { useLanguage } from '@hooks/useLanguage'
import { PeraCardRowHeader } from './PeraCardRowHeader'
import { useStyles } from './styles'

type PeraCardConnectedRowProps = {
    /** When true, indent the card and draw the connector to the account above. */
    nested: boolean
    onPress?: () => void
}

export const PeraCardConnectedRow = ({
    nested,
    onPress,
}: PeraCardConnectedRowProps) => {
    const { t } = useLanguage()
    const styles = useStyles()

    // TODO(card): derive the real label from lastKnownStatus / useCardUserQuery
    // once the on-chain link and card-status wiring lands.
    const cardContent = (
        <PeraCardRowHeader>
            <PWView style={styles.statusRow}>
                <PWIcon
                    name='check'
                    size='sm'
                    variant='secondary'
                />
                <PWText
                    variant='footnoteMedium'
                    style={styles.statusLabel}
                    numberOfLines={1}
                >
                    {t('peraCard.account_item.status_approved')}
                </PWText>
            </PWView>
        </PeraCardRowHeader>
    )

    const card = onPress ? (
        <PWTouchableOpacity
            style={[styles.container, styles.solidBorder]}
            onPress={onPress}
            testID='pera_card_connected_row'
        >
            {cardContent}
        </PWTouchableOpacity>
    ) : (
        <PWView style={[styles.container, styles.solidBorder]}>
            {cardContent}
        </PWView>
    )

    if (!nested) return card

    return (
        <PWView style={styles.nestedWrapper}>
            <PWView style={styles.connector} />
            {card}
        </PWView>
    )
}
