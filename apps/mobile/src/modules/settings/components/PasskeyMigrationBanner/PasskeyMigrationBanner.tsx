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

import type { StyleProp, ViewStyle } from 'react-native'
import { PWButton, PWIcon, PWText, PWView } from '@components/core'
import { useLanguage } from '@hooks/useLanguage'
import type { Passkey } from '@perawallet/wallet-core-passkeys'
import { useStyles } from './styles'

export type PasskeyMigrationBannerProps = {
    affected: Passkey[]
    onRecreate: (passkey: Passkey) => void
    onDismiss: () => void
    style?: StyleProp<ViewStyle>
}

/**
 * Every action here is the user's. A flagged passkey still signs in, so
 * removing one the relying party still trusts would lock the user out of that
 * account — the banner explains the trade-off and hands the credential to the
 * screen's confirming delete flow, and never deletes on its own.
 */
export const PasskeyMigrationBanner = ({
    affected,
    onRecreate,
    onDismiss,
    style,
}: PasskeyMigrationBannerProps) => {
    const styles = useStyles()
    const { t } = useLanguage()

    return (
        <PWView
            style={[styles.container, style]}
            testID='settings_passkeys_migration_banner'
        >
            <PWIcon
                name='warning'
                variant='warning'
            />
            <PWView style={styles.textColumn}>
                <PWText variant='body'>
                    {t('settings.passkeys.migration_warning_title')}
                </PWText>
                <PWText
                    variant='caption'
                    style={styles.body}
                >
                    {t('settings.passkeys.migration_warning_body')}
                </PWText>

                {affected.map(passkey => (
                    <PWView
                        key={passkey.id}
                        style={styles.credentialRow}
                    >
                        <PWText
                            variant='caption'
                            numberOfLines={1}
                            style={styles.credentialName}
                        >
                            {passkey.displayName}
                        </PWText>
                        <PWButton
                            variant='destructiveLight'
                            paddingStyle='dense'
                            title={t('settings.passkeys.migration_warning_cta')}
                            onPress={() => onRecreate(passkey)}
                            testID={`settings_passkeys_migration_recreate_${passkey.id}`}
                        />
                    </PWView>
                ))}

                <PWView style={styles.actions}>
                    <PWButton
                        variant='linkNeutral'
                        paddingStyle='dense'
                        title={t('settings.passkeys.migration_warning_dismiss')}
                        onPress={onDismiss}
                        testID='settings_passkeys_migration_dismiss'
                    />
                </PWView>
            </PWView>
        </PWView>
    )
}
