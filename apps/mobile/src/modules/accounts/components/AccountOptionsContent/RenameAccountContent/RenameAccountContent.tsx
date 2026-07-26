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

import { useState } from 'react'
import { BottomSheetTextInput } from '@gorhom/bottom-sheet'
import { PWButton, PWInput, PWSheetLayout, PWView } from '@components/core'
import { useAccountsStore } from '@perawallet/wallet-core-accounts'
import { SheetHeader, useBottomSheetResult } from '@modules/bottom-sheet'
import { useLanguage } from '@hooks/useLanguage'
import { useStyles } from './styles'

export type RenameAccountContentProps = {
    accountAddress: string
}

export const RenameAccountContent = ({
    accountAddress,
}: RenameAccountContentProps) => {
    const { t } = useLanguage()
    const account = useAccountsStore(s =>
        s.accounts.find(a => a.address === accountAddress),
    )
    const initialName = account?.name ?? ''
    const [name, setName] = useState(initialName)
    const styles = useStyles()
    const { resolve } = useBottomSheetResult<string>()

    const trimmed = name.trim()
    const isSaveDisabled = trimmed.length === 0

    const handleSave = () => {
        if (isSaveDisabled) return
        resolve(trimmed)
    }

    return (
        <PWSheetLayout
            horizontalPadding='none'
            header={<SheetHeader title={t('account_options.rename_title')} />}
        >
            <PWView style={styles.inputContainer}>
                <PWInput
                    testID='rename_account_input'
                    value={name}
                    onChangeText={setName}
                    placeholder={t('account_options.rename_label')}
                    autoFocus
                    inputStyle={styles.input}
                    InputComponent={BottomSheetTextInput}
                />
            </PWView>
            <PWView style={styles.buttonContainer}>
                <PWButton
                    testID='rename_account_save_button'
                    variant='primary'
                    title={t('account_options.rename_save')}
                    onPress={handleSave}
                    isDisabled={isSaveDisabled}
                />
            </PWView>
        </PWSheetLayout>
    )
}
