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

import { Platform } from 'react-native'
import { PWButton, PWIcon, PWText, PWView } from '@components/core'
import { useLanguage } from '@hooks/useLanguage'
import { PasskeysHero } from '../PasskeysHero'
import { useStyles } from './styles'

export type PasskeysDisabledStateProps = {
    onOpenSettings: () => void
}

export const PasskeysDisabledState = ({
    onOpenSettings,
}: PasskeysDisabledStateProps) => {
    const styles = useStyles()
    const { t } = useLanguage()

    const bodyKey =
        Platform.OS === 'android'
            ? 'settings.passkeys.disabled_body_android'
            : 'settings.passkeys.disabled_body_ios'
    const infoBodyKey =
        Platform.OS === 'android'
            ? 'settings.passkeys.disabled_info_body_android'
            : 'settings.passkeys.disabled_info_body_ios'

    return (
        <PWView
            style={styles.disabledContainer}
            testID='settings_passkeys_disabled_state'
        >
            <PWView style={styles.disabledHero}>
                <PasskeysHero />
                <PWText style={styles.disabledBody}>{t(bodyKey)}</PWText>
            </PWView>
            <PWView style={styles.infoCard}>
                <PWView style={styles.infoHeaderRow}>
                    <PWIcon name='info' />
                    <PWText variant='body'>
                        {t('settings.passkeys.disabled_info_header')}
                    </PWText>
                </PWView>
                <PWText style={styles.infoCardBody}>{t(infoBodyKey)}</PWText>
                <PWButton
                    variant='primary'
                    onPress={onOpenSettings}
                    title={t('settings.passkeys.disabled_cta')}
                    iconRight='arrow-up-right'
                />
            </PWView>
        </PWView>
    )
}
