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

import { PWButton, PWText, PWView } from '@components/core'
import { useLanguage } from '@hooks/useLanguage'
import { useSwapTrackedOrdersList } from './useSwapTrackedOrdersList'
import { useStyles } from './styles'

export const SwapTrackedOrders = () => {
    const { t } = useLanguage()
    const styles = useStyles()
    const { rows, isVisible, handleDismiss } = useSwapTrackedOrdersList()

    if (!isVisible) return null

    return (
        <PWView
            style={styles.container}
            testID='swap_tracked_orders'
        >
            {rows.map(row => (
                <PWView
                    key={row.orderId}
                    style={styles.row}
                    testID={`swap_tracked_order_${row.orderId}`}
                >
                    <PWView style={styles.texts}>
                        <PWText
                            variant='body'
                            weight={500}
                        >
                            {row.pairLabel}
                        </PWText>
                        <PWText
                            variant='caption'
                            style={styles.status}
                        >
                            {row.statusText}
                        </PWText>
                    </PWView>
                    {row.isSettled && (
                        <PWButton
                            variant='linkNeutral'
                            paddingStyle='none'
                            title={t('swap.tracking.dismiss')}
                            onPress={() => handleDismiss(row.orderId)}
                            testID={`swap_tracked_order_dismiss_${row.orderId}`}
                        />
                    )}
                </PWView>
            ))}
        </PWView>
    )
}
