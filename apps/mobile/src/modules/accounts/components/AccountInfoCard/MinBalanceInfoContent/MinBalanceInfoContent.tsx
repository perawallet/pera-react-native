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

import { PWButton, PWText, PWView } from '@components/core'
import { useBottomSheetResult } from '@modules/bottom-sheet'
import { useLanguage } from '@hooks/useLanguage'
import { useStyles } from './styles'

export type MinBalanceInfoContentProps = Record<string, never>

export const MinBalanceInfoContent = (_: MinBalanceInfoContentProps = {}) => {
    const styles = useStyles()
    const { t } = useLanguage()
    const { dismiss } = useBottomSheetResult<void>()

    return (
        <>
            <PWText
                variant='h3'
                style={styles.title}
            >
                {t('min_balance_info.title')}
            </PWText>
            <PWText style={styles.description}>
                {t('min_balance_info.description')}
            </PWText>
            <PWView style={styles.actions}>
                <PWButton
                    variant='secondary'
                    title={t('min_balance_info.close')}
                    onPress={dismiss}
                    paddingStyle='dense'
                    testID='min-balance-info-close-button'
                />
            </PWView>
        </>
    )
}
