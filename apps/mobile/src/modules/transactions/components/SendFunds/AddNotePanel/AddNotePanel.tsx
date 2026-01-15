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
    type PWBottomSheetProps,
    PWIcon,
    PWInput,
    PWText,
    PWView,
} from '@components/core'
import { useContext, useEffect, useState } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { useStyles } from './styles'
import { SendFundsContext } from '@modules/transactions/providers/SendFundsProvider'
import { useLanguage } from '@hooks/language'
import { zodResolver } from '@hookform/resolvers/zod'
import { noteSchema } from '@perawallet/wallet-core-blockchain'

type AddNotePanelProps = {
    onClose: () => void
} & PWBottomSheetProps

export const AddNotePanel = ({
    isVisible,
    onClose,
    ...rest
}: AddNotePanelProps) => {
    const styles = useStyles()
    const { note, setNote } = useContext(SendFundsContext)
    const [isEdit, setIsEdit] = useState(!!note)
    const { t } = useLanguage()

    const {
        control,
        handleSubmit,
        reset,
        formState: { errors },
    } = useForm({
        resolver: zodResolver(noteSchema),
        defaultValues: { note },
    })

    const handleClose = () => {
        onClose()
    }

    const done = ({ note: inputNote }: { note?: string }) => {
        setNote(inputNote)
        handleClose()
    }

    useEffect(() => {
        reset({ note })
        setIsEdit(!!note)
    }, [note, reset])

    return (
        <PWBottomSheet
            isVisible={isVisible}
            {...rest}
        >
            <PWView style={styles.container}>
                <PWView style={styles.titleContainer}>
                    <PWIcon
                        name='cross'
                        variant='secondary'
                        onPress={handleClose}
                    />
                    <PWText variant='h4'>
                        {isEdit
                            ? t('send_funds.confirmation.edit')
                            : t('send_funds.add_note.button').replace(
                                  '+ ',
                                  '',
                              )}{' '}
                        Note
                    </PWText>
                    <PWText onPress={handleSubmit(done)}>
                        {t('send_funds.add_note.done')}
                    </PWText>
                </PWView>
                <PWView style={styles.container}>
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
                            />
                        )}
                    />
                </PWView>
            </PWView>
        </PWBottomSheet>
    )
}
