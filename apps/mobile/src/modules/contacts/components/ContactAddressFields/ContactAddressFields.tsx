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

import type { ChainFamily } from '@perawallet/wallet-core-chain-contract'
import type { AddressFamilyMatch } from '@perawallet/wallet-core-contacts'
import type { Optional } from '@perawallet/wallet-core-shared'
import {
    PWButton,
    PWLoadingIndicator,
    PWText,
    PWTouchableIcon,
    PWView,
} from '@components/core'
import { AddressEntryField } from '@components/AddressEntryField'
import { useLanguage } from '@hooks/useLanguage'
import type { ContactAddressRow as ContactAddressRowData } from '../../hooks/useContactForm'
import { ContactAddressRow } from '../ContactAddressRow'
import { useStyles } from './styles'
import { useContactAddressFields } from './useContactAddressFields'

export type ContactAddressFieldsProps = {
    rows: ContactAddressRowData[]
    isInputVisible: boolean
    rawInput: string
    isInputInvalid: boolean
    isResolvingNfd: boolean
    pendingReplacement: Optional<AddressFamilyMatch>
    onShowInput: () => void
    onInputChange: (text: string) => void
    onConfirmReplacement: () => void
    onCancelReplacement: () => void
    onRemove: (family: ChainFamily) => void
}

export const ContactAddressFields = ({
    rows,
    isInputVisible,
    rawInput,
    isInputInvalid,
    isResolvingNfd,
    pendingReplacement,
    onShowInput,
    onInputChange,
    onConfirmReplacement,
    onCancelReplacement,
    onRemove,
}: ContactAddressFieldsProps) => {
    const { t } = useLanguage()
    const styles = useStyles()
    const { scanChainIds, handlePaste } = useContactAddressFields({
        pendingReplacement,
        onAddressInputChange: onInputChange,
        confirmReplacement: onConfirmReplacement,
        cancelReplacement: onCancelReplacement,
    })

    return (
        <PWView style={styles.container}>
            <PWText
                variant='h4'
                style={styles.label}
            >
                {t('contacts.edit_contact.addresses_label')}
            </PWText>
            {rows.map(({ family, address, isDuplicate }) => (
                <ContactAddressRow
                    key={family}
                    family={family}
                    address={address}
                    testID={`contact_address_row_${family}`}
                    footer={
                        isDuplicate ? (
                            <PWText
                                variant='caption'
                                style={styles.warning}
                                testID='contact_address_warning'
                            >
                                {t(
                                    'contacts.add_contact.duplicate_address_warning',
                                )}
                            </PWText>
                        ) : null
                    }
                    right={
                        <PWTouchableIcon
                            name='trash'
                            variant='secondary'
                            onPress={() => onRemove(family)}
                            accessibilityLabel={t(
                                'contacts.edit_contact.remove_address',
                            )}
                            testID={`contact_address_remove_${family}`}
                        />
                    }
                />
            ))}
            {isInputVisible ? (
                <PWView style={styles.entry}>
                    <AddressEntryField
                        chainIds={scanChainIds}
                        allowQRCode
                        label={t('contacts.edit_contact.address_label')}
                        value={rawInput}
                        onChangeText={onInputChange}
                        errorMessage={
                            isInputInvalid
                                ? t('contacts.edit_contact.invalid_address')
                                : undefined
                        }
                        testID='contact_address_input'
                    />
                    {isResolvingNfd ? (
                        <PWView style={styles.nfdStatus}>
                            <PWLoadingIndicator size='sm' />
                            <PWText
                                variant='caption'
                                style={styles.nfdStatusText}
                            >
                                {t('address_entry.nfd_resolving')}
                            </PWText>
                        </PWView>
                    ) : null}
                    <PWButton
                        variant='link'
                        icon='copy'
                        title={t('address_entry.paste_from_clipboard')}
                        paddingStyle='none'
                        onPress={() => void handlePaste()}
                        style={styles.paste}
                        testID='contact_address_paste_button'
                    />
                </PWView>
            ) : (
                <PWButton
                    variant='helper'
                    icon='plus'
                    paddingStyle='dense'
                    title={t('contacts.edit_contact.add_address')}
                    onPress={onShowInput}
                    style={styles.add}
                    testID='contact_add_address_button'
                />
            )}
        </PWView>
    )
}
