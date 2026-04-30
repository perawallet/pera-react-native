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

import {
    PWBottomSheet,
    type PWBottomSheetProps,
    PWButton,
    PWIcon,
    PWText,
    PWView,
} from '@components/core'
import { useStyles } from './styles'
import { useLanguage } from '@hooks/useLanguage'

export type InsufficientBalancePanelProps = {
    onClose: () => void
    onContinue: () => void
    minBalance: string
} & PWBottomSheetProps

export const InsufficientBalancePanel = ({
    isVisible,
    onClose,
    onContinue,
    minBalance,
    ...rest
}: InsufficientBalancePanelProps) => {
    const styles = useStyles()
    const { t } = useLanguage()

    return (
        <PWBottomSheet
            isVisible={isVisible}
            {...rest}
            innerContainerStyle={styles.container}
        >
            <PWIcon
                name='warning'
                size='xxl'
                variant='error'
            />
            <PWView style={styles.bodyContainer}>
                <PWText
                    variant='h3'
                    style={styles.title}
                >
                    {t('send_funds.input.min_balance_title')}
                </PWText>
                <PWText style={styles.body}>
                    {t('send_funds.input.min_balance_amount', { minBalance })}
                </PWText>
                <PWText style={styles.body}>
                    {t('send_funds.input.min_balance_body')}
                </PWText>
            </PWView>
            <PWView style={styles.buttonContainer}>
                <PWButton
                    variant='primary'
                    onPress={onContinue}
                    title={t('common.continue.label')}
                    style={styles.button}
                />
                <PWButton
                    variant='secondary'
                    onPress={onClose}
                    title={t('common.cancel.label')}
                    style={styles.button}
                />
            </PWView>
        </PWBottomSheet>
    )
}
