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

import { PWButton, PWDivider, PWView } from '@components/core'
import { useLanguage } from '@hooks/useLanguage'
import { useStyles } from './styles'
import { useTheme } from '@rneui/themed'
import { useSigningActionButtons } from './useSigningActionButtons'

export const SigningActionButtons = () => {
    const styles = useStyles()
    const { t } = useLanguage()
    const { theme } = useTheme()
    const {
        handleReject,
        handleSignAndSend,
        isLoading,
        hasMultipleTransactions,
    } = useSigningActionButtons()

    return (
        <PWView style={styles.container}>
            <PWDivider color={theme.colors.layerGray} />
            <PWView style={styles.buttonContainer}>
                <PWButton
                    title={t('common.cancel.label')}
                    variant='secondary'
                    onPress={handleReject}
                    isDisabled={isLoading}
                    style={styles.button}
                />
                <PWButton
                    title={
                        hasMultipleTransactions
                            ? t('common.confirm_all.label')
                            : t('common.confirm.label')
                    }
                    variant='primary'
                    onPress={handleSignAndSend}
                    isLoading={isLoading}
                    style={styles.button}
                />
            </PWView>
        </PWView>
    )
}
