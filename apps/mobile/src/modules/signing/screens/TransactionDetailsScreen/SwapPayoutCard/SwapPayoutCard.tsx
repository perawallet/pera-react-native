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

import { PWIcon, PWText, PWTouchableOpacity, PWView } from '@components/core'
import type { SwapPayoutRef } from '@perawallet/wallet-core-swaps'
import { useLanguage } from '@hooks/useLanguage'
import { TransactionDetailCard } from '@modules/signing/transactions/TransactionDetailCard'
import { useStyles } from './styles'
import { useSwapPayoutCard } from './useSwapPayoutCard'

export type SwapPayoutCardProps = {
    payout: SwapPayoutRef
}

export const SwapPayoutCard = ({ payout }: SwapPayoutCardProps) => {
    const { t } = useLanguage()
    const styles = useStyles()
    const { isShown, label, isPending, handleOpen } = useSwapPayoutCard(payout)

    if (!isShown) return null

    return (
        <TransactionDetailCard testID='transaction_detail_swap_payout'>
            {isPending ? (
                <PWView style={styles.row}>
                    <PWText
                        variant='bodyLarge'
                        style={styles.label}
                    >
                        {label}
                    </PWText>
                    <PWText
                        variant='body'
                        style={styles.pending}
                    >
                        {t('transactions.common.pending')}
                    </PWText>
                </PWView>
            ) : (
                <PWTouchableOpacity
                    testID='transaction_detail_swap_payout_explorer'
                    style={styles.row}
                    onPress={handleOpen}
                    accessibilityRole='link'
                >
                    <PWText
                        variant='bodyLarge'
                        style={styles.label}
                    >
                        {label}
                    </PWText>
                    <PWIcon
                        name='arrow-up-right'
                        variant='secondary'
                    />
                </PWTouchableOpacity>
            )}
        </TransactionDetailCard>
    )
}
