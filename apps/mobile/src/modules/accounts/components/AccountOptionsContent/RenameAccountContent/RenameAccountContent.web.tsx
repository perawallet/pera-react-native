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

// Web twin of RenameAccountContent: the native version wires PWInput up to
// gorhom's `BottomSheetTextInput` (needed there so typing inside the real
// gorhom sheet keeps focus/keyboard behavior in sync with the sheet). On web
// PWBottomSheet.web.tsx never mounts a real gorhom `<BottomSheet>`, so
// `BottomSheetTextInput` throws "'useBottomSheetInternal' cannot be used out
// of the BottomSheet!" the instant this renders — an uncaught error with no
// root boundary, which blanks the whole web app. Omitting `InputComponent`
// falls back to PWInput's default (a plain RN TextInput), which is all the
// web Modal-based sheet needs.
import { PWButton, PWInput, PWSheetLayout, PWView } from '@components/core'
import { SheetHeader } from '@modules/bottom-sheet'
import { useLanguage } from '@hooks/useLanguage'
import { useStyles } from './styles'
import { useRenameAccountContent } from './useRenameAccountContent'

export type RenameAccountContentProps = {
    accountId: string
}

export const RenameAccountContent = ({
    accountId,
}: RenameAccountContentProps) => {
    const { t } = useLanguage()
    const styles = useStyles()
    const { name, nameError, isSaveDisabled, handleNameChange, handleSave } =
        useRenameAccountContent(accountId)

    return (
        <PWSheetLayout
            horizontalPadding='none'
            header={<SheetHeader title={t('account_options.rename_title')} />}
        >
            <PWView style={styles.inputContainer}>
                <PWInput
                    value={name}
                    onChangeText={handleNameChange}
                    errorMessage={nameError}
                    placeholder={t('account_options.rename_label')}
                    autoFocus
                    inputStyle={styles.input}
                    testID='rename_account_input'
                />
            </PWView>
            <PWView style={styles.buttonContainer}>
                <PWButton
                    variant='primary'
                    title={t('account_options.rename_save')}
                    onPress={handleSave}
                    isDisabled={isSaveDisabled}
                    testID='rename_account_save_button'
                />
            </PWView>
        </PWSheetLayout>
    )
}
