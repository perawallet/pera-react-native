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

import { type ReactNode } from 'react'
import { KeyboardAvoidingView } from 'react-native'
import { ScrollView } from 'react-native-gesture-handler'
import { type Control, Controller } from 'react-hook-form'
import { PWInput, PWText, PWView } from '@components/core'
import { ContactAvatar } from '@components/ContactAvatar'
import { AddressEntryField } from '@components/AddressEntryField'
import { AddressDisplay } from '@components/AddressDisplay'
import { useStyles } from './styles'

type ContactFormProps = {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    control: Control<any>
    address: string
    nameLabel: string
    namePlaceholder?: string
    addressLabel: string
    nameError?: string
    isAddressEditable?: boolean
    addressError?: string
    children?: ReactNode
}

export const ContactForm = ({
    control,
    address,
    nameLabel,
    namePlaceholder,
    addressLabel,
    nameError,
    isAddressEditable,
    addressError,
    children,
}: ContactFormProps) => {
    const styles = useStyles()

    return (
        <KeyboardAvoidingView behavior='height'>
            <ScrollView style={styles.container}>
                <PWView style={styles.avatar}>
                    <ContactAvatar
                        size='xl'
                        contact={{ name: '', address }}
                    />
                </PWView>
                <PWView style={styles.formContainer}>
                    <Controller
                        control={control}
                        name='name'
                        render={({ field: { onChange, onBlur, value } }) => (
                            <PWInput
                                onBlur={onBlur}
                                onChangeText={onChange}
                                value={value}
                                label={nameLabel}
                                placeholder={namePlaceholder}
                                errorMessage={nameError}
                            />
                        )}
                    />
                    {isAddressEditable && (
                        <Controller
                            control={control}
                            name='address'
                            render={({
                                field: { onChange, onBlur, value },
                            }) => (
                                <AddressEntryField
                                    allowQRCode
                                    label={addressLabel}
                                    onBlur={onBlur}
                                    onChangeText={onChange}
                                    value={value}
                                    errorMessage={addressError}
                                />
                            )}
                        />
                    )}
                    {!isAddressEditable && (
                        <PWView>
                            <PWText style={styles.label}>{addressLabel}</PWText>
                            <AddressDisplay
                                address={address}
                                addressFormat='full'
                                showCopy={false}
                                displayType='address-only'
                            />
                        </PWView>
                    )}
                    {children}
                </PWView>
            </ScrollView>
        </KeyboardAvoidingView>
    )
}
