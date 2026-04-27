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

import { KeyboardAvoidingView, Platform } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTheme } from '@rneui/themed'

import { PWButton, PWView } from '@components/core'
import { ContactForm } from '@components/ContactForm'
import { PhotoPermissionDeniedSheet } from '@components/PhotoPermissionDeniedSheet'
import { useKeyboardHeight } from '@hooks/useKeyboardHeight'
import { useLanguage } from '@hooks/useLanguage'
import { useAddContactForm } from '@modules/contacts/hooks'
import { useStyles } from './styles'

export const AddContactScreen = () => {
    const { t } = useLanguage()
    const { theme } = useTheme()
    const { keyboardHeight } = useKeyboardHeight()
    const insets = useSafeAreaInsets()
    const footerPaddingBottom =
        keyboardHeight > 0
            ? theme.spacing.xxl
            : Math.max(insets.bottom, theme.spacing.md)
    const styles = useStyles({ footerPaddingBottom })

    const {
        control,
        handleSubmit,
        errors,
        isValid,
        rawAddressInput,
        imageUri,
        nfd,
        onAddressInputChange,
        onPickImage,
        permissionDenied,
        save,
    } = useAddContactForm()

    return (
        <KeyboardAvoidingView
            style={styles.flex}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
            <ContactForm
                control={control}
                address={nfd.isNfdResolved ? nfd.resolvedAddress : ''}
                nameLabel={t('contacts.edit_contact.name_label')}
                addressLabel={t('contacts.edit_contact.address_label')}
                nameError={errors.name?.message}
                addressError={errors.address?.message}
                nfdName={nfd.isNfdResolved ? nfd.nfdName : undefined}
                isResolvingNfd={nfd.isNfdResolving}
                onAddressInputChange={onAddressInputChange}
                rawAddressInput={rawAddressInput}
                imageUri={imageUri}
                onPickImage={onPickImage}
            />
            <PWView style={styles.footer}>
                <PWButton
                    onPress={handleSubmit(save)}
                    title={t('contacts.edit_contact.add_contact')}
                    variant='primary'
                    isDisabled={!isValid}
                    style={styles.footerButton}
                />
            </PWView>
            <PhotoPermissionDeniedSheet
                isVisible={permissionDenied.isVisible}
                onClose={permissionDenied.close}
                onOpenSettings={permissionDenied.openSettings}
            />
        </KeyboardAvoidingView>
    )
}
