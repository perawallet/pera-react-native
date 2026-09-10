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

import { PWIcon, PWText, PWTouchableOpacity, PWView } from '@components/core'
import { useLanguage } from '@hooks/useLanguage'
import { getTestProps } from '@utils/test-id-helper'
import { useStyles } from './styles'

export type EncryptionKeyFieldProps = {
    encryptionKey: string
    onCopy: () => void
    copyTestID: string
}

/** Labelled, truncating encryption-key row with a copy affordance. */
export const EncryptionKeyField = ({
    encryptionKey,
    onCopy,
    copyTestID,
}: EncryptionKeyFieldProps) => {
    const { t } = useLanguage()
    const styles = useStyles()

    return (
        <PWView style={styles.section}>
            <PWText
                variant='body'
                style={styles.label}
            >
                {t('cloud_backup.encryption_key_label')}
            </PWText>
            <PWView style={styles.keyField}>
                <PWText
                    variant='bodyLarge'
                    style={styles.keyText}
                    truncate
                >
                    {encryptionKey}
                </PWText>
                <PWTouchableOpacity
                    onPress={onCopy}
                    {...getTestProps(copyTestID)}
                >
                    <PWIcon
                        name='copy'
                        variant='positive'
                    />
                </PWTouchableOpacity>
            </PWView>
        </PWView>
    )
}
