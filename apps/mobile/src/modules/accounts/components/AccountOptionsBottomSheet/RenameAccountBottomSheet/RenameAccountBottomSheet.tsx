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

import { useState } from 'react'
import {
    PWBottomSheet,
    PWButton,
    PWIcon,
    PWInput,
    PWText,
    PWToolbar,
    PWView,
} from '@components/core'
import { useLanguage } from '@hooks/useLanguage'
import { useKeyboardHeight } from '@hooks/useKeyboardHeight'
import { useStyles } from './styles'

export type RenameAccountBottomSheetProps = {
    isVisible: boolean
    onClose: () => void
    onRename: (newName: string) => void
    currentName: string
}

export const RenameAccountBottomSheet = ({
    isVisible,
    onClose,
    onRename,
    currentName,
}: RenameAccountBottomSheetProps) => {
    const { t } = useLanguage()
    const [name, setName] = useState(currentName)
    const { keyboardHeight } = useKeyboardHeight()
    const styles = useStyles({ keyboardHeight })

    const handleSave = () => {
        const trimmed = name.trim()
        if (trimmed.length > 0) {
            onRename(trimmed)
        }
    }

    return (
        <PWBottomSheet
            isVisible={isVisible}
            onBackdropPress={onClose}
            innerContainerStyle={styles.container}
            containerStyle={styles.keyboardContainer}
            scrollViewProps={{
                keyboardShouldPersistTaps: 'handled',
            }}
        >
            <PWToolbar
                right={
                    <PWIcon
                        name='cross'
                        onPress={onClose}
                    />
                }
            />
            <PWText
                variant='h3'
                style={styles.title}
            >
                {t('account_options.rename_title')}
            </PWText>
            <PWView style={styles.inputContainer}>
                <PWInput
                    value={name}
                    onChangeText={setName}
                    placeholder={t('account_options.rename_placeholder')}
                    autoFocus
                />
            </PWView>
            <PWView style={styles.buttonContainer}>
                <PWButton
                    variant='primary'
                    title={t('account_options.rename_save')}
                    onPress={handleSave}
                    isDisabled={name.trim().length === 0}
                />
            </PWView>
        </PWBottomSheet>
    )
}
