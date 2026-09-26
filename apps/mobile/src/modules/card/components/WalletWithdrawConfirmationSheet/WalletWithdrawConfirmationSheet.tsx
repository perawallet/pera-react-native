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
import type { CardWalletKind } from '@perawallet/wallet-core-card'
import { useLanguage } from '@hooks/useLanguage'
import { CardConfirmationSheet } from '../CardConfirmationSheet'
import { useWalletWithdrawConfirmationSheet } from './useWalletWithdrawConfirmationSheet'

type WalletWithdrawConfirmationSheetProps = {
    kind: CardWalletKind
    /** Withdraw amount in display units. */
    amount: Decimal
}

/**
 * Confirmation sheet shown before claiming a wallet balance. The withdrawal
 * runs here: the confirm button shows the pending state and the sheet closes
 * on success.
 */
export const WalletWithdrawConfirmationSheet = ({
    kind,
    amount,
}: WalletWithdrawConfirmationSheetProps) => {
    const { t } = useLanguage()
    const { copy, amountDisplay, isWithdrawing, onConfirm, onClose } =
        useWalletWithdrawConfirmationSheet({ kind, amount })

    return (
        <CardConfirmationSheet
            title={t('peraCard.credits.confirm_title')}
            body={t(copy.confirmBody, { amount: amountDisplay })}
            confirmLabel={t('peraCard.credits.confirm_button')}
            isPending={isWithdrawing}
            onConfirm={onConfirm}
            onClose={onClose}
            testID='wallet_withdraw_confirmation_sheet'
            confirmTestID='wallet_withdraw_confirm_button'
            closeTestID='wallet_withdraw_close_button'
        />
    )
}
