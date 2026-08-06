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

import { type ReactNode, useCallback, useRef, useState } from 'react'
import { ActivityIndicator } from 'react-native'
import {
    type Control,
    Controller,
    type FieldPath,
    type FieldValues,
} from 'react-hook-form'
import { truncateAlgorandAddress } from '@perawallet/wallet-core-shared'

import {
    PWIcon,
    PWInput,
    type PWInputRef,
    PWText,
    PWTouchableOpacity,
    PWView,
} from '@components/core'
import { ContactAvatar } from '@components/ContactAvatar'
import { QRScannerView } from '@components/QRScannerView'
import { useScannedAddress } from '@hooks/useScannedAddress'
import { useLanguage } from '@hooks/useLanguage'
import { useStyles } from './styles'

type ContactFormProps<T extends FieldValues> = {
    control: Control<T>
    address: string
    nameLabel: string
    addressLabel: string
    nameError?: string
    addressError?: string
    nfdName?: string
    isResolvingNfd?: boolean
    onAddressInputChange?: (text: string) => void
    rawAddressInput?: string
    imageUri?: string
    onPickImage?: () => void
    children?: ReactNode
}

export const ContactForm = <T extends FieldValues>({
    control,
    address,
    nameLabel,
    addressLabel,
    nameError,
    addressError,
    nfdName,
    isResolvingNfd,
    onAddressInputChange,
    rawAddressInput,
    imageUri,
    onPickImage,
    children,
}: ContactFormProps<T>) => {
    const { t } = useLanguage()
    const styles = useStyles()
    const [scannerVisible, setScannerVisible] = useState(false)
    const addressInputRef = useRef<PWInputRef>(null)
    const resolveScannedAddress = useScannedAddress()

    const renderAvatar = () => (
        <ContactAvatar
            size='xxl'
            contact={{ name: '', address, image: imageUri }}
        />
    )

    const handleScan = useCallback(
        (url: string) => {
            setScannerVisible(false)
            const scanned = resolveScannedAddress(url)
            if (scanned) {
                onAddressInputChange?.(scanned)
            }
        },
        [onAddressInputChange, resolveScannedAddress],
    )

    const handleOpenScanner = useCallback(() => setScannerVisible(true), [])
    const handleCloseScanner = useCallback(() => setScannerVisible(false), [])

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
                            returnKeyType='next'
                            blurOnSubmit={false}
                            onSubmitEditing={() =>
                                addressInputRef.current?.focus()
                            }
                            testID='contact_name_input'
                        />
                    )}
                />
                <Controller
                    control={control}
                    name={'address' as FieldPath<T>}
                    render={({ field: { onBlur } }) => (
                        <PWInput
                            ref={addressInputRef}
                            label={addressLabel}
                            value={rawAddressInput ?? address ?? ''}
                            onChangeText={onAddressInputChange}
                            onBlur={onBlur}
                            errorMessage={addressError}
                            editable={Boolean(onAddressInputChange)}
                            autoCapitalize='none'
                            autoCorrect={false}
                            testID='contact_address_input'
                            rightIcon={
                                onAddressInputChange ? (
                                    <PWView style={styles.scanIconWrapper}>
                                        <PWIcon
                                            name='camera'
                                            onPress={handleOpenScanner}
                                        />
                                    </PWView>
                                ) : undefined
                            }
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
                {children}
            </PWView>
            <QRScannerView
                isVisible={scannerVisible}
                onSuccess={handleScan}
                onClose={handleCloseScanner}
                animationType='slide'
                title={t('address_entry.scan_qr')}
                skipDeepLinkHandler
            />
        </>
    )
}
