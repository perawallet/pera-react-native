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
import { ActivityIndicator, KeyboardAvoidingView } from 'react-native'
import {
    type Control,
    Controller,
    type FieldPath,
    type FieldValues,
} from 'react-hook-form'
import { PWInput, PWScrollView, PWText, PWView } from '@components/core'
import { ContactAvatar } from '@components/ContactAvatar'
import { AddressEntryField } from '@components/AddressEntryField'
import { AddressDisplay } from '@components/AddressDisplay'
import { useStyles } from './styles'
import { useLanguage } from '@hooks/useLanguage'
import { truncateAlgorandAddress } from '@perawallet/wallet-core-shared'

type ContactFormProps<T extends FieldValues> = {
    control: Control<T>
    address: string
    nameLabel: string
    namePlaceholder?: string
    addressLabel: string
    nameError?: string
    isAddressEditable?: boolean
    addressError?: string
    nfdName?: string
    isResolvingNfd?: boolean
    onAddressInputChange?: (text: string) => void
    rawAddressInput?: string
    children?: ReactNode
}

export const ContactForm = <T extends FieldValues>({
    control,
    address,
    nameLabel,
    namePlaceholder,
    addressLabel,
    nameError,
    isAddressEditable,
    addressError,
    nfdName,
    isResolvingNfd,
    onAddressInputChange,
    rawAddressInput,
    children,
}: ContactFormProps<T>) => {
    const styles = useStyles()
    const { t } = useLanguage()

    return (
        <KeyboardAvoidingView behavior='height'>
            <PWScrollView style={styles.container}>
                <PWView style={styles.avatar}>
                    <ContactAvatar
                        size='xl'
                        contact={{ name: '', address }}
                    />
                </PWView>
                <PWView style={styles.formContainer}>
                    <Controller
                        control={control}
                        name={'name' as FieldPath<T>}
                        render={({ field: { onChange, onBlur, value } }) => (
                            <PWInput
                                onBlur={onBlur}
                                onChangeText={onChange}
                                value={value}
                                label={nameLabel}
                                placeholder={namePlaceholder}
                                errorMessage={nameError}
                                autoCapitalize='none'
                            />
                        )}
                    />
                    {isAddressEditable && (
                        <>
                            <Controller
                                control={control}
                                name={'address' as FieldPath<T>}
                                render={({ field: { onBlur } }) => (
                                    <AddressEntryField
                                        allowQRCode
                                        label={addressLabel}
                                        onBlur={onBlur}
                                        onChangeText={
                                            onAddressInputChange ?? (() => {})
                                        }
                                        value={rawAddressInput ?? ''}
                                        errorMessage={addressError}
                                    />
                                )}
                            />
                            {isResolvingNfd && (
                                <PWView style={styles.nfdStatus}>
                                    <ActivityIndicator size='small' />
                                    <PWText
                                        variant='caption'
                                        style={styles.nfdStatusText}
                                    >
                                        {t('address_entry.nfd_resolving')}
                                    </PWText>
                                </PWView>
                            )}
                            {nfdName && (
                                <PWView style={styles.nfdStatus}>
                                    <PWText
                                        variant='caption'
                                        style={styles.nfdStatusText}
                                    >
                                        {t('address_entry.nfd_resolved', {
                                            name: nfdName,
                                        })}
                                        {' — '}
                                        {truncateAlgorandAddress(address)}
                                    </PWText>
                                </PWView>
                            )}
                        </>
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
            </PWScrollView>
        </KeyboardAvoidingView>
    )
}
