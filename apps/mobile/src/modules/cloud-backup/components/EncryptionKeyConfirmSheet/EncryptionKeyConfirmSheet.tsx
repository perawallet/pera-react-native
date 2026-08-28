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

import { useSafeAreaInsets } from 'react-native-safe-area-context'

import {
    PWButton,
    PWCheckbox,
    PWIcon,
    PWText,
    PWTouchableOpacity,
    PWView,
} from '@components/core'
import { useLanguage } from '@hooks/useLanguage'
import { getTestProps } from '@utils/test-id-helper'

import { EncryptionKeyField } from '../EncryptionKeyField'
import { useEncryptionKeyConfirmSheet } from './useEncryptionKeyConfirmSheet'
import { useStyles } from './styles'

const ConfirmHeader = () => {
    const { t } = useLanguage()
    const styles = useStyles()

    return (
        <>
            <PWIcon
                name='info'
                size='xxl'
                variant='positive'
                style={styles.icon}
            />
            <PWText
                variant='h3'
                style={styles.title}
            >
                {t('cloud_backup.confirm.title')}
            </PWText>
        </>
    )
}

type ConfirmationCheckboxProps = {
    isConfirmed: boolean
    onToggle: () => void
}

const ConfirmationCheckbox = ({
    isConfirmed,
    onToggle,
}: ConfirmationCheckboxProps) => {
    const { t } = useLanguage()
    const styles = useStyles()

    return (
        <PWTouchableOpacity
            style={styles.checkboxRow}
            onPress={onToggle}
            {...getTestProps('cloud_backup_confirm_checkbox')}
        >
            <PWCheckbox
                checked={isConfirmed}
                onPress={onToggle}
            />
            <PWText variant='bodyLarge'>
                {t('cloud_backup.confirm.checkbox_label')}
            </PWText>
        </PWTouchableOpacity>
    )
}

type EnableBackupButtonProps = {
    isDisabled: boolean
    onPress: () => void
}

const EnableBackupButton = ({
    isDisabled,
    onPress,
}: EnableBackupButtonProps) => {
    const { t } = useLanguage()

    return (
        <PWButton
            variant='primary'
            title={t('cloud_backup.confirm.enable_button')}
            isDisabled={isDisabled}
            onPress={onPress}
            testID='cloud_backup_confirm_enable_button'
        />
    )
}

type ShowCredentialsButtonProps = {
    onPress: () => void
}

const ShowCredentialsButton = ({ onPress }: ShowCredentialsButtonProps) => {
    const { t } = useLanguage()

    return (
        <PWButton
            variant='linkNeutral'
            title={t('cloud_backup.confirm.show_again_button')}
            onPress={onPress}
            testID='cloud_backup_confirm_show_again_button'
        />
    )
}

export const EncryptionKeyConfirmSheet = () => {
    const insets = useSafeAreaInsets()
    const styles = useStyles({ bottomInset: insets.bottom })
    const {
        salt,
        isConfirmed,
        toggleConfirmed,
        handleCopy,
        handleEnable,
        handleShowCredentials,
    } = useEncryptionKeyConfirmSheet()

    return (
        <PWView style={styles.container}>
            <ConfirmHeader />
            <EncryptionKeyField
                encryptionKey={salt}
                onCopy={handleCopy}
                copyTestID='cloud_backup_confirm_copy_key'
            />
            <ConfirmationCheckbox
                isConfirmed={isConfirmed}
                onToggle={toggleConfirmed}
            />
            <PWView style={styles.actions}>
                <EnableBackupButton
                    isDisabled={!isConfirmed}
                    onPress={handleEnable}
                />
                <ShowCredentialsButton onPress={handleShowCredentials} />
            </PWView>
        </PWView>
    )
}
