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

import type { Decimal } from 'decimal.js'
import { AccountDisplay } from '@modules/accounts/components/AccountDisplay'
import { useLanguage } from '@hooks/useLanguage'
import { CardConfirmationSheet } from '../CardConfirmationSheet'
import { useCardWithdrawConfirmationSheet } from './useCardWithdrawConfirmationSheet'

type CardWithdrawConfirmationSheetProps = {
    /** Withdraw amount in display units (whole USDC). */
    amount: Decimal
}

/**
 * Confirmation sheet shown before withdrawing from the card. The withdrawal
 * runs here — the confirm button shows the pending state and the sheet closes
 * on success.
 */
export const CardWithdrawConfirmationSheet = ({
    amount,
}: CardWithdrawConfirmationSheetProps) => {
    const { t } = useLanguage()
    const {
        amountDisplay,
        destinationAccount,
        isWithdrawing,
        onConfirm,
        onClose,
    } = useCardWithdrawConfirmationSheet({ amount })

    return (
        <CardConfirmationSheet
            title={t('peraCard.withdraw.confirm_title')}
            body={t('peraCard.withdraw.confirm_body', {
                amount: amountDisplay,
            })}
            confirmLabel={t('peraCard.withdraw.confirm_button')}
            isPending={isWithdrawing}
            onConfirm={onConfirm}
            onClose={onClose}
            testID='card_withdraw_confirmation_sheet'
            confirmTestID='card_withdraw_confirm_button'
            closeTestID='card_withdraw_close_button'
        >
            <AccountDisplay
                account={destinationAccount ?? undefined}
                showChevron={false}
                noBorder
                iconProps={{ size: 'sm' }}
                testID='card-withdraw-destination-account'
            />
        </CardConfirmationSheet>
    )
}
