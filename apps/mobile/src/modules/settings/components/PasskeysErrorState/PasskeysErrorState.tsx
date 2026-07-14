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

import { PWButton, PWIcon, PWText, PWView } from '@components/core'
import { useLanguage } from '@hooks/useLanguage'
import { useStyles } from './styles'

export type PasskeysErrorStateProps = {
    onDismiss: () => void
}

export const PasskeysErrorState = ({ onDismiss }: PasskeysErrorStateProps) => {
    const styles = useStyles()
    const { t } = useLanguage()

    return (
        <PWView style={styles.centered}>
            <PWIcon
                name='info'
                variant='error'
                size='lg'
            />
            <PWText
                variant='h3'
                style={styles.centeredText}
            >
                {t('settings.passkeys.error_title')}
            </PWText>
            <PWText style={styles.centeredSubtext}>
                {t('settings.passkeys.error_body')}
            </PWText>
            <PWButton
                variant='primary'
                onPress={onDismiss}
                title={t('settings.passkeys.error_cta')}
            />
        </PWView>
    )
}
