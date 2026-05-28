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

import { PWButton, PWIcon, PWText, PWView } from '@components/core'
import { useLanguage } from '@hooks/useLanguage'
import { useBottomSheetResult } from '@modules/bottom-sheet'
import { useStyles } from './styles'

/**
 * Shown from the deeplink handler when a FIDO request is scanned on a device
 * without a strong biometric. Blocks the hand-off to the OS credential flow —
 * which would otherwise dead-end — and explains the requirement.
 */
export const PasskeyBiometricRequiredContent = () => {
    const styles = useStyles()
    const { t } = useLanguage()
    const { dismiss } = useBottomSheetResult()

    return (
        <PWView style={styles.container}>
            <PWView style={styles.iconWrap}>
                <PWIcon
                    name='info'
                    size='xl'
                />
            </PWView>
            <PWText
                variant='h3'
                style={styles.title}
            >
                {t('settings.passkeys.biometric_warning_title')}
            </PWText>
            <PWText style={styles.body}>
                {t('settings.passkeys.biometric_required_body')}
            </PWText>
            <PWView style={styles.actions}>
                <PWButton
                    variant='primary'
                    onPress={dismiss}
                    title={t('settings.passkeys.biometric_required_dismiss')}
                />
            </PWView>
        </PWView>
    )
}
