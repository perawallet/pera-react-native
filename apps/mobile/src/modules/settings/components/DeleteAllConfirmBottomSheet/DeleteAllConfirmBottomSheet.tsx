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
import { useDeleteAllConfirm } from './useDeleteAllConfirm'
import { useLanguage } from '@hooks/useLanguage'
import { useStyles } from './DeleteAllConfirmBottomSheet.style'

export const DeleteAllConfirmBottomSheet = (props: {
    isOpen: boolean
    onClose: () => void
}) => {
    const { isOpen, onClose } = props
    const { t } = useLanguage()
    const styles = useStyles()
    const { handleDeleteAllAccounts } = useDeleteAllConfirm(onClose)

    return (
        <PWBottomSheet
            isVisible={isOpen}
            onBackdropPress={onClose}
            innerContainerStyle={styles.bottomSheetContainer}
        >
            <PWIcon
                name='trash'
                variant='error'
                size='xl'
                style={styles.bottomSheetIcon}
            />
            <PWText variant='h3'>{t('settings.main.remove_title')}</PWText>
            <PWText style={styles.bottomSheetMessage}>
                {t('settings.main.remove_message')}
            </PWText>
            <PWView style={styles.bottomSheetActions}>
                <PWButton
                    variant='primary'
                    title={t('settings.main.remove_confirm')}
                    onPress={handleDeleteAllAccounts}
                    paddingStyle='dense'
                />
                <PWButton
                    variant='secondary'
                    title={t('settings.main.remove_cancel')}
                    onPress={onClose}
                    paddingStyle='dense'
                />
            </PWView>
        </PWBottomSheet>
    )
}
