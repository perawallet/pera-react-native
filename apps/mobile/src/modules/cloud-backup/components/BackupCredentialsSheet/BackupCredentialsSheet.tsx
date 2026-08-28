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

import {
    PWButton,
    PWIcon,
    PWSheetLayout,
    PWText,
    PWTouchableOpacity,
    PWView,
} from '@components/core'
import { LoadingView } from '@components/LoadingView'
import { PassphraseGrid } from '@components/PassphraseGrid'
import { useLanguage } from '@hooks/useLanguage'
import { usePreventScreenCapture } from '@hooks/usePreventScreenCapture'
import { SheetHeader } from '@modules/bottom-sheet'
import { getTestProps } from '@utils/test-id-helper'

import { EncryptionKeyField } from '../EncryptionKeyField'

import {
    useBackupCredentialsSheet,
    type PassphraseStatus,
} from './useBackupCredentialsSheet'
import { useStyles } from './styles'

const SCREEN_CAPTURE_TAG = 'backup-credentials'

type CredentialAddressSectionProps = {
    address: string
}

const CredentialAddressSection = ({
    address,
}: CredentialAddressSectionProps) => {
    const { t } = useLanguage()
    const styles = useStyles()

    return (
        <PWView style={styles.section}>
            <PWText
                variant='body'
                style={styles.label}
            >
                {t('cloud_backup.credentials.credential_address_label')}
            </PWText>
            <PWText variant='bodyLarge'>{address}</PWText>
        </PWView>
    )
}

type PassphraseSectionProps = {
    wordIndices: Uint16Array
    status: PassphraseStatus
    onCopy: () => void
    onRestore: () => void
}

const PassphraseSection = ({
    wordIndices,
    status,
    onCopy,
    onRestore,
}: PassphraseSectionProps) => {
    const { t } = useLanguage()
    const styles = useStyles()

    return (
        <PWView style={styles.section}>
            <PWText
                variant='body'
                style={styles.label}
            >
                {t('cloud_backup.credentials.passphrase_label')}
            </PWText>
            {status === 'loading' && (
                <PWView style={styles.loading}>
                    <LoadingView
                        variant='circle'
                        size='sm'
                    />
                </PWView>
            )}
            {status === 'ready' && (
                <>
                    <PassphraseGrid wordIndices={wordIndices} />
                    <PWTouchableOpacity
                        style={styles.copyLink}
                        onPress={onCopy}
                        {...getTestProps('backup_credentials_copy_passphrase')}
                    >
                        <PWIcon
                            name='copy'
                            variant='positive'
                        />
                        <PWText
                            variant='bodyLarge'
                            weight={500}
                            style={styles.copyLinkText}
                        >
                            {t('cloud_backup.credentials.copy_passphrase')}
                        </PWText>
                    </PWTouchableOpacity>
                </>
            )}
            {status === 'unavailable' && (
                <PWText
                    variant='bodyLarge'
                    style={styles.errorText}
                    {...getTestProps('backup_credentials_passphrase_missing')}
                >
                    {t('cloud_backup.credentials.passphrase_missing')}
                </PWText>
            )}
            {status === 'unreadable' && (
                <>
                    <PWText
                        variant='bodyLarge'
                        style={styles.errorText}
                        {...getTestProps(
                            'backup_credentials_passphrase_unreadable',
                        )}
                    >
                        {t('cloud_backup.credentials.passphrase_unreadable')}
                    </PWText>
                    <PWButton
                        variant='secondary'
                        title={t('cloud_backup.credentials.restore_button')}
                        onPress={onRestore}
                        testID='backup_credentials_restore_button'
                    />
                </>
            )}
        </PWView>
    )
}

export const BackupCredentialsSheet = () => {
    const { t } = useLanguage()
    const styles = useStyles()
    const {
        credentialAddress,
        encryptionKey,
        wordIndices,
        passphraseStatus,
        handleCopyPassphrase,
        handleCopyEncryptionKey,
        handleRestore,
        handleClose,
    } = useBackupCredentialsSheet()

    usePreventScreenCapture(SCREEN_CAPTURE_TAG, true)

    return (
        <PWSheetLayout
            testID='backup_credentials_sheet'
            header={
                <SheetHeader
                    title={t('cloud_backup.credentials.title')}
                    showClose
                />
            }
            footer={
                <PWButton
                    variant='primary'
                    title={t('cloud_backup.credentials.done_button')}
                    onPress={handleClose}
                    testID='backup_credentials_done_button'
                />
            }
        >
            <PWView style={styles.body}>
                <CredentialAddressSection address={credentialAddress} />
                <PassphraseSection
                    wordIndices={wordIndices}
                    status={passphraseStatus}
                    onCopy={handleCopyPassphrase}
                    onRestore={handleRestore}
                />
                <EncryptionKeyField
                    encryptionKey={encryptionKey}
                    onCopy={handleCopyEncryptionKey}
                    copyTestID='backup_credentials_copy_encryption_key'
                />
            </PWView>
        </PWSheetLayout>
    )
}
