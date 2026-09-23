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

import type { ReactNode } from 'react'
import { PWIcon, PWText, PWView } from '@components/core'
import { useLanguage } from '@hooks/useLanguage'
import { useStyles } from './styles'

export type BackupPasskeyRowProps = {
    /** What the credential calls itself. For one only the backup holds this is
     *  the cached label, which is why the row takes it rather than resolving
     *  one: the credential is by definition not on this device. */
    label: string
    /** Omitted when only the cached label is known. */
    origin?: string
    isBackedUp: boolean
    trailing?: ReactNode
    /** Renders under the text column, so a wide control can't squeeze the label. */
    action?: ReactNode
    testID?: string
}

export const BackupPasskeyRow = ({
    label,
    origin,
    isBackedUp,
    trailing,
    action,
    testID,
}: BackupPasskeyRowProps) => {
    const { t } = useLanguage()
    const styles = useStyles()

    return (
        <PWView
            style={styles.row}
            testID={testID}
        >
            <PWIcon name='person-key' />
            <PWView style={styles.body}>
                <PWView style={styles.titleRow}>
                    <PWText
                        variant='bodyLarge'
                        numberOfLines={1}
                        ellipsizeMode='tail'
                        style={styles.title}
                    >
                        {label || t('cloud_backup.passkeys.unnamed')}
                    </PWText>
                    <PWIcon
                        name={isBackedUp ? 'cloud-check' : 'cloud-off'}
                        variant={isBackedUp ? 'positive' : 'error'}
                        size='sm'
                        testID={
                            isBackedUp
                                ? 'backup_passkey_row_backed_up'
                                : 'backup_passkey_row_not_backed_up'
                        }
                    />
                </PWView>
                {origin !== undefined && origin !== label && (
                    <PWText
                        variant='body'
                        numberOfLines={1}
                        ellipsizeMode='tail'
                        style={styles.origin}
                    >
                        {origin}
                    </PWText>
                )}
                {action}
            </PWView>
            {trailing}
        </PWView>
    )
}
