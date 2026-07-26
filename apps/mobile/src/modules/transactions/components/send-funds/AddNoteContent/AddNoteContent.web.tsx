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

// Web twin of AddNoteContent: see RenameAccountContent.web.tsx for why the
// gorhom `BottomSheetTextInput` override must be dropped on web (it throws
// "'useBottomSheetInternal' cannot be used out of the BottomSheet!" outside a
// real gorhom sheet, which PWBottomSheet.web.tsx never mounts).
import { PWInput, PWSheetLayout, PWText } from '@components/core'
import { useState } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { useSendFunds } from '@modules/transactions/hooks'
import { useLanguage } from '@hooks/useLanguage'
import { zodResolver } from '@hookform/resolvers/zod'
import { noteSchema } from '@perawallet/wallet-core-blockchain'
import { SheetHeader, useBottomSheetResult } from '@modules/bottom-sheet'

export const AddNoteContent = () => {
    const { note, setNote } = useSendFunds()
    const [isEdit] = useState(!!note)
    const { t } = useLanguage()
    const { dismiss } = useBottomSheetResult()

    const {
        control,
        handleSubmit,
        formState: { errors },
    } = useForm({
        resolver: zodResolver(noteSchema),
        defaultValues: { note },
    })

    const done = ({ note: inputNote }: { note?: string }) => {
        setNote(inputNote)
        dismiss()
    }

    return (
        <PWSheetLayout
            header={
                <SheetHeader
                    title={
                        isEdit
                            ? t('send_funds.add_note.edit')
                            : t('send_funds.add_note.button')
                    }
                    rightAction={
                        <PWText onPress={() => void handleSubmit(done)()}>
                            {t('send_funds.add_note.done')}
                        </PWText>
                    }
                />
            }
        >
            <Controller
                control={control}
                name='note'
                render={({ field: { onChange, onBlur, value } }) => (
                    <PWInput
                        onBlur={onBlur}
                        onChangeText={onChange}
                        value={value}
                        label={t('send_funds.add_note.placeholder')}
                        errorMessage={errors.note?.message}
                        autoFocus
                    />
                )}
            />
        </PWSheetLayout>
    )
}
