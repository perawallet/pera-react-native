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

import { type ReactNode } from 'react'
import {
    type Control,
    Controller,
    type FieldPath,
    type FieldValues,
} from 'react-hook-form'

import {
    PWIcon,
    PWInput,
    PWText,
    PWTouchableOpacity,
    PWView,
} from '@components/core'
import { ContactAvatar } from '@components/ContactAvatar'
import { useLanguage } from '@hooks/useLanguage'
import { useStyles } from './styles'

type ContactFormProps<T extends FieldValues> = {
    control: Control<T>
    nameLabel: string
    nameError?: string
    /** Edits the addresses; replaces the read-only `address` field. */
    addressSection?: ReactNode
    /** Shown read-only when there is no `addressSection`. */
    address?: string
    addressLabel?: string
    imageUri?: string
    onPickImage?: () => void
    children?: ReactNode
}

export const ContactForm = <T extends FieldValues>({
    control,
    nameLabel,
    nameError,
    addressSection,
    address,
    addressLabel,
    imageUri,
    onPickImage,
    children,
}: ContactFormProps<T>) => {
    const { t } = useLanguage()
    const styles = useStyles()

    const renderAvatar = () => (
        <ContactAvatar
            size='xxl'
            contact={{ name: '', addresses: {}, image: imageUri }}
        />
    )

    return (
        <>
            <PWView style={styles.avatarWrapper}>
                {onPickImage ? (
                    <PWTouchableOpacity
                        onPress={onPickImage}
                        style={styles.avatarTouchable}
                    >
                        {renderAvatar()}
                        <PWView style={styles.avatarBadge}>
                            <PWIcon
                                name={imageUri ? 'pen-solid' : 'plus'}
                                variant='buttonPrimary'
                                size='md'
                            />
                        </PWView>
                    </PWTouchableOpacity>
                ) : (
                    renderAvatar()
                )}
                {!!onPickImage && !imageUri && (
                    <PWText
                        variant='h3'
                        style={styles.addPhotoLabel}
                    >
                        {t('contacts.edit_contact.add_photo')}
                    </PWText>
                )}
            </PWView>
            <PWView style={styles.formContainer}>
                <Controller
                    control={control}
                    name={'name' as FieldPath<T>}
                    render={({ field: { onChange, onBlur, value } }) => (
                        <PWInput
                            label={nameLabel}
                            value={value ?? ''}
                            onChangeText={onChange}
                            onBlur={onBlur}
                            errorMessage={nameError}
                            autoCapitalize='none'
                            autoCorrect={false}
                            returnKeyType='done'
                            testID='contact_name_input'
                        />
                    )}
                />
                {addressSection ??
                    (address !== undefined && (
                        <PWInput
                            label={addressLabel}
                            value={address}
                            editable={false}
                            testID='contact_address_input'
                        />
                    ))}
                {children}
            </PWView>
        </>
    )
}
