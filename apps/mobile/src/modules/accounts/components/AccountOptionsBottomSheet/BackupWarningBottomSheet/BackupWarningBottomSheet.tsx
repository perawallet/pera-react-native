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

import {
    PWBottomSheet,
    PWButton,
    PWIcon,
    PWText,
    PWView,
} from '@components/core'
import { useLanguage } from '@hooks/useLanguage'
import { useStyles } from './styles'

export type BackupWarningBottomSheetProps = {
    isVisible: boolean
    onClose: () => void
    onContinue: () => void
}

export const BackupWarningBottomSheet = ({
    isVisible,
    onClose,
    onContinue,
}: BackupWarningBottomSheetProps) => {
    const { t } = useLanguage()
    const styles = useStyles()

    return (
        <PWBottomSheet
            isVisible={isVisible}
            onBackdropPress={onClose}
            innerContainerStyle={styles.container}
        >
            <PWIcon
                name='info'
                variant='error'
                size='xl'
                style={styles.icon}
            />
            <PWText variant='h3'>
                {t('account_options.backup_warning_title')}
            </PWText>
            <PWText style={styles.message}>
                {t('account_options.backup_warning_message')}
            </PWText>
            <PWView style={styles.actions}>
                <PWButton
                    variant='destructive'
                    title={t('account_options.backup_warning_continue')}
                    onPress={onContinue}
                    paddingStyle='dense'
                />
                <PWButton
                    variant='secondary'
                    title={t('account_options.backup_warning_cancel')}
                    onPress={onClose}
                    paddingStyle='dense'
                />
            </PWView>
        </PWBottomSheet>
    )
}
