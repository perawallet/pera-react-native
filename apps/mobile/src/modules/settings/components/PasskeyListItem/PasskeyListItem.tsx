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

import { PWIcon, PWText, PWTouchableIcon, PWView } from '@components/core'
import { useLanguage } from '@hooks/useLanguage'
import type { Passkey } from '@perawallet/wallet-core-passkeys'
import { resolveLastUsed } from './resolveLastUsed'
import { useStyles } from './styles'

export type PasskeyListItemProps = {
    passkey: Passkey
    /** Omitted when this passkey must not be removable — the icon is dropped. */
    onRemovePress?: (passkey: Passkey) => void
    testID?: string
}

export const PasskeyListItem = ({
    passkey,
    onRemovePress,
    testID,
}: PasskeyListItemProps) => {
    const styles = useStyles()
    const { t } = useLanguage()

    // iOS keeps the WebAuthn user.name in `userName` while Android stores it in
    // the title (`displayName`). Only surface the row when it adds something the
    // title doesn't, so the card looks the same on both platforms.
    const userName = passkey.userName ?? ''
    const showUserName = userName.length > 0 && userName !== passkey.displayName

    const lastUsed = resolveLastUsed(passkey.lastUsedAt)
    const lastUsedLabel =
        lastUsed.kind === 'never'
            ? t('settings.passkeys.last_used_never')
            : lastUsed.kind === 'today'
              ? t('settings.passkeys.last_used_today')
              : lastUsed.value

    return (
        <PWView
            style={styles.container}
            testID={testID}
        >
            <PWView style={styles.headerRow}>
                <PWView style={styles.headerLeft}>
                    <PWIcon name='person-key' />
                    <PWView style={styles.titleColumn}>
                        <PWText
                            variant='body'
                            numberOfLines={1}
                        >
                            {passkey.displayName}
                        </PWText>
                        <PWText
                            variant='caption'
                            style={styles.subtitle}
                            numberOfLines={1}
                        >
                            {passkey.origin}
                        </PWText>
                    </PWView>
                </PWView>
                {onRemovePress && (
                    <PWTouchableIcon
                        name='trash'
                        variant='secondary'
                        onPress={() => onRemovePress(passkey)}
                    />
                )}
            </PWView>

            <PWView style={styles.divider} />
            <PWView style={styles.metaRow}>
                <PWText variant='caption'>
                    {t('settings.passkeys.last_used')}
                </PWText>
                <PWText
                    variant='caption'
                    style={styles.metaValue}
                >
                    {lastUsedLabel}
                </PWText>
            </PWView>

            {showUserName && (
                <>
                    <PWView style={styles.divider} />
                    <PWView style={styles.metaRow}>
                        <PWText variant='caption'>
                            {t('settings.passkeys.username')}
                        </PWText>
                        <PWText
                            variant='caption'
                            style={styles.metaValue}
                        >
                            {userName}
                        </PWText>
                    </PWView>
                </>
            )}
        </PWView>
    )
}
