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

import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import { PWText, PWTouchableOpacity, PWView } from '@components/core'
import { PeraCardRowHeader } from './PeraCardRowHeader'
import { useStyles } from './styles'
import { usePeraCardConnectedRow } from './usePeraCardConnectedRow'

type PeraCardConnectedRowProps = {
    /** When true, indent the card and draw the connector to the account above. */
    nested: boolean
    scope: ChainScope
    onPress?: () => void
}

export const PeraCardConnectedRow = ({
    nested,
    scope,
    onPress,
}: PeraCardConnectedRowProps) => {
    const styles = useStyles()
    const { statusLabel } = usePeraCardConnectedRow(scope)

    const cardContent = (
        <PeraCardRowHeader>
            {statusLabel ? (
                <PWText
                    variant='footnoteMedium'
                    style={styles.statusLabel}
                    numberOfLines={1}
                    testID='pera_card_connected_row_status'
                >
                    {statusLabel}
                </PWText>
            ) : null}
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
