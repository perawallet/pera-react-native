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

import { Dialog, Input, Text, useTheme } from '@rneui/themed'
import ContactAvatar from '../../components/common/contact-avatar/ContactAvatar'
import PWView from '../../components/common/view/PWView'
import AddressEntryField from '../../components/address/address-entry/AddressEntryField'
import {
    Contact,
    useContacts,
    contactSchema,
} from '@perawallet/wallet-core-contacts'
import { ParamListBase, useNavigation } from '@react-navigation/native'
import { KeyboardAvoidingView } from 'react-native'
import { useStyles } from './EditContactScreen.styles'
import PWButton from '../../components/common/button/PWButton'
import { ScrollView } from 'react-native-gesture-handler'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm, Controller } from 'react-hook-form'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { useState } from 'react'
import AddressDisplay from '../../components/address/address-display/AddressDisplay'

const EditContactScreen = () => {
    const styles = useStyles()
    const {
        saveContact,
        findContacts,
        deleteContact,
        selectedContact,
        setSelectedContact,
    } = useContacts()
    const navigation = useNavigation<NativeStackNavigationProp<ParamListBase>>()
    const { theme } = useTheme()
    const [deleteModalOpen, setDeleteModalOpen] = useState(false)
    const isEditMode = !!selectedContact

    const {
        control,
        handleSubmit,
        setError,
        formState: { isValid, errors },
    } = useForm({
        resolver: zodResolver(contactSchema),
        defaultValues: selectedContact ?? {},
    })

    const openDeleteModal = () => {
        setDeleteModalOpen(true)
    }

    const closeDeleteModal = () => {
        setDeleteModalOpen(false)
    }

    const save = (data: Contact) => {
        if (!isEditMode) {
            const matches = findContacts({
                keyword: data.address,
                matchAddress: true,
                matchName: false,
                matchNFD: false,
            })

            if (matches?.length) {
                setError('address', {
                    message: 'Contact for this address already exists.',
                })
                return
            }
        }

        if (isValid) {
            saveContact(data)
            setSelectedContact(null)
            navigation.goBack()
        }
    }

    const removeContact = () => {
        if (!isEditMode) {
            navigation.replace('Contacts')
        } else {
            deleteContact(selectedContact)
            setSelectedContact(null)
            navigation.replace('Contacts')
        }
    }

    return (
        <KeyboardAvoidingView behavior='height'>
            <ScrollView style={styles.container}>
                <PWView style={styles.avatar}>
                    <ContactAvatar
                        size='large'
                        contact={selectedContact ?? { name: '', address: '' }}
                    />
                </PWView>
                <PWView style={styles.formContainer}>
                    <Controller
                        control={control}
                        name='name'
                        render={({ field: { onChange, onBlur, value } }) => (
                            <Input
                                onBlur={onBlur}
                                onChangeText={onChange}
                                value={value}
                                label='Name'
                                errorMessage={errors.name?.message}
                            />
                        )}
                    />
                    {!isEditMode && (
                        <Controller
                            control={control}
                            name='address'
                            render={({
                                field: { onChange, onBlur, value },
                            }) => (
                                <AddressEntryField
                                    allowQRCode
                                    label='Address'
                                    onBlur={onBlur}
                                    onChangeText={onChange}
                                    value={value}
                                    errorMessage={errors.address?.message}
                                />
                            )}
                        />
                    )}
                    {isEditMode && (
                        <PWView>
                            <Text style={styles.label}>Address</Text>
                            <AddressDisplay
                                address={selectedContact.address}
                                showCopy
                                rawDisplay
                            />
                        </PWView>
                    )}
                    <PWView style={styles.buttonContainer}>
                        {isEditMode && (
                            <PWButton
                                onPress={openDeleteModal}
                                title='Delete'
                                variant='destructive'
                                minWidth={100}
                            />
                        )}
                        <PWButton
                            onPress={handleSubmit(save)}
                            title='Save'
                            variant='primary'
                            minWidth={100}
                        />
                    </PWView>
                </PWView>
            </ScrollView>
            <Dialog
                isVisible={deleteModalOpen}
                onBackdropPress={closeDeleteModal}
            >
                <Dialog.Title title='Are you sure?' />
                <Text>Are you sure you want to delete this contact?</Text>
                <Dialog.Actions>
                    <Dialog.Button
                        title='Delete'
                        titleStyle={{ color: theme.colors.error }}
                        onPress={removeContact}
                    />
                    <Dialog.Button
                        title='Cancel'
                        onPress={closeDeleteModal}
                    />
                </Dialog.Actions>
            </Dialog>
        </KeyboardAvoidingView>
    )
}

export default EditContactScreen
