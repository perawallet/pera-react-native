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

import { PWButton, PWView } from '@components/core'
import { useLanguage } from '@hooks/useLanguage'
import { useStyles } from './styles'

type PeraCardActionButtonsProps = {
    isAutoFunding: boolean
    onWithdraw: () => void
    onAddFunds: () => void
    onGetUsdc: () => void
}

export const PeraCardActionButtons = ({
    isAutoFunding,
    onWithdraw,
    onAddFunds,
    onGetUsdc,
}: PeraCardActionButtonsProps) => {
    const { t } = useLanguage()
    const styles = useStyles()

    if (isAutoFunding) {
        return (
            <PWButton
                variant='primary'
                title={t('peraCard.account.get_usdc')}
                onPress={onGetUsdc}
                testID='pera_card_get_usdc_button'
            />
        )
    }

    return (
        <PWView style={styles.buttons}>
            <PWButton
                variant='secondary'
                title={t('peraCard.account.withdraw')}
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
