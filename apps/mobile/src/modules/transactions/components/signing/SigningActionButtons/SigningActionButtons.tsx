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
import { useSigningContext } from '../TransactionSigningContext'
import { useStyles } from './styles'

export const SigningActionButtons = () => {
    const styles = useStyles()
    const { t } = useLanguage()
    const { allTransactions, isLoading, signAndSend, rejectRequest } =
        useSigningContext()

    return (
        <PWView style={styles.container}>
            <PWButton
                title={t('common.cancel.label')}
                variant='secondary'
                onPress={rejectRequest}
                isDisabled={isLoading}
                style={styles.button}
            />
            <PWButton
                title={
                    allTransactions.length > 1
                        ? t('common.confirm_all.label')
                        : t('common.confirm.label')
                }
                variant='primary'
                onPress={signAndSend}
                isLoading={isLoading}
                style={styles.button}
            />
        </PWView>
    )
}
