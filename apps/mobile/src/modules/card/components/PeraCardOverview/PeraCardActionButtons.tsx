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

import { PWButton, PWView } from '@components/core'
import { useLanguage } from '@hooks/useLanguage'
import type { CardWithdrawState } from './usePeraCardOverview'
import { useStyles } from './styles'

const WITHDRAW_TITLE_KEYS = {
    idle: 'peraCard.account.withdraw',
    waiting: 'peraCard.withdraw.in_progress_button',
    ready: 'peraCard.withdraw.complete_button',
} as const

type PeraCardActionButtonsProps = {
    isAutoFunding: boolean
    /** An open request turns the button into the way back to it. */
    withdrawState: CardWithdrawState
    onWithdraw: () => void
    onAddFunds: () => void
    /** Auto funding: tops up the linked account rather than the card. */
    onFundLinkedAccount: () => void
}

export const PeraCardActionButtons = ({
    isAutoFunding,
    withdrawState,
    onWithdraw,
    onAddFunds,
    onFundLinkedAccount,
}: PeraCardActionButtonsProps) => {
    const { t } = useLanguage()
    const styles = useStyles()

    if (isAutoFunding) {
        return (
            <PWButton
                variant='primary'
                title={t('peraCard.account.add_funds')}
                onPress={onFundLinkedAccount}
                testID='pera_card_fund_linked_account_button'
            />
        )
    }

    return (
        <PWView style={styles.buttons}>
            <PWButton
                variant='secondary'
                title={t(WITHDRAW_TITLE_KEYS[withdrawState])}
                onPress={onWithdraw}
                testID='pera_card_withdraw_button'
            />
            <PWButton
                variant='primary'
                title={t('peraCard.account.add_funds')}
                onPress={onAddFunds}
                testID='pera_card_add_funds_button'
            />
        </PWView>
    )
}
