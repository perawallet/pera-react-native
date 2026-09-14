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

import { Pressable } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { PWIcon, PWToolbar, PWView } from '@components/core'
import { useLanguage } from '@hooks/useLanguage'
import { useBottomSheetResult } from '@modules/bottom-sheet'
import { PinEntry } from '@modules/security'
import { getTestProps } from '@utils/test-id-helper'

import { useBackupCodeSheet } from './useBackupCodeSheet'
import { useStyles } from './styles'

export type BackupCodeSheetProps = {
    /** The scanned envelope, already validated by `parseBackupSyncQrEnvelope`. */
    raw: string
}

/**
 * Open with `size: 'full'` and `autoCreateContainer: false` — gorhom's
 * `BottomSheetView` is content-sized, so the numpad cannot flex-fill without
 * the plain container.
 */
export const BackupCodeSheet = ({ raw }: BackupCodeSheetProps) => {
    const { t } = useLanguage()
    const insets = useSafeAreaInsets()
    const styles = useStyles({ insets })
    const { dismiss } = useBottomSheetResult()

    const {
        hasError,
        isDeriving,
        handleCodeComplete,
        handleErrorAnimationComplete,
    } = useBackupCodeSheet({ raw })

    return (
        <PWView
            style={styles.container}
            testID='backup_code_sheet'
        >
            <PWToolbar
                left={
                    <Pressable
                        {...getTestProps('backup_code_close_button')}
                        onPress={dismiss}
                    >
                        <PWIcon name='cross' />
                    </Pressable>
                }
                paddingStyle='normal'
                style={styles.toolbar}
            />
            <PWView style={styles.pinContainer}>
                <PinEntry
                    title={t('cloud_backup.restore_scan.code_title')}
                    onPinComplete={code => void handleCodeComplete(code)}
                    isDisabled={isDeriving}
                    hasError={hasError}
                    onErrorAnimationComplete={handleErrorAnimationComplete}
                />
            </PWView>
        </PWView>
    )
}
