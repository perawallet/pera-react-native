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

import { PWIcon, PWText, PWTouchableOpacity, PWView } from '@components/core'
import { useStyles } from './styles'

import { useMemo, useState } from 'react'
import { AddressEntryField } from '@components/AddressEntryField'
import { truncateAlgorandAddress } from '@perawallet/wallet-core-shared'
import { useContacts } from '@perawallet/wallet-core-contacts'
import { useAllAccounts } from '@perawallet/wallet-core-accounts'
import { isValidAlgorandAddress } from '@perawallet/wallet-core-blockchain'
import { ScrollView } from 'react-native'
import { AccountDisplay } from '@modules/accounts/components/AccountDisplay'
import { EmptyView } from '@components/EmptyView'
import { AddressDisplay } from '@components/AddressDisplay'
import { useLanguage } from '@hooks/language'

type AddressSearchViewProps = {
    onSelected: (address: string) => void
}

export const AddressSearchView = ({ onSelected }: AddressSearchViewProps) => {
    const styles = useStyles()
    const [value, setValue] = useState('')
    const { findContacts } = useContacts()
    const accounts = useAllAccounts()
    const { t } = useLanguage()

    const addressIsValid = useMemo(() => isValidAlgorandAddress(value), [value])
    const matchingAccounts = useMemo(
        () => accounts.filter(a => a.address.includes(value)),
        [value, accounts],
    )
    const matchingContacts = useMemo(
        () => (value.length ? findContacts({ keyword: value }) : []),
        [value, findContacts],
    )
    return (
        <PWView style={styles.container}>
            <AddressEntryField
                onChangeText={setValue}
                value={value}
                allowQRCode
                placeholder={t('address_entry.search_placeholder')}
                inputContainerStyle={styles.searchField}
                leftIcon={
                    <PWIcon
                        variant='secondary'
                        name='magnifying-glass'
                    />
                }
            />
            {!addressIsValid &&
            !matchingAccounts.length &&
            !matchingContacts.length ? (
                <EmptyView
                    title={t('address_entry.no_accounts_found')}
                    body={t('address_entry.no_accounts_body')}
                />
            ) : (
                <ScrollView>
                    {addressIsValid && (
                        <PWTouchableOpacity onPress={() => onSelected(value)}>
                            <PWText
                                variant='h4'
                                style={styles.title}
                            >
                                {t('address_entry.address')}
                            </PWText>
                            <PWText>{truncateAlgorandAddress(value)}</PWText>
                        </PWTouchableOpacity>
                    )}
                    {!!matchingContacts.length && (
                        <PWView style={styles.section}>
                            <PWText
                                variant='h4'
                                style={styles.title}
                            >
                                {t('address_entry.contacts')}
                            </PWText>
                            {matchingContacts.map(c => (
                                <PWTouchableOpacity
                                    key={`contact-${c.address}`}
                                    onPress={() => onSelected(c.address)}
                                >
                                    <AddressDisplay
                                        address={c.address}
                                        showCopy={false}
                                        style={styles.accountDisplay}
                                    />
                                </PWTouchableOpacity>
                            ))}
                        </PWView>
                    )}
                    {!!matchingAccounts.length && (
                        <PWView style={styles.section}>
                            <PWText
                                variant='h4'
                                style={styles.title}
                            >
                                {t('address_entry.my_accounts')}
                            </PWText>
                            {matchingAccounts.map(acct => (
                                <PWTouchableOpacity
                                    key={`account-${acct.address}`}
                                    onPress={() => onSelected(acct.address)}
                                >
                                    <AccountDisplay
                                        account={acct}
                                        showChevron={false}
                                        style={styles.accountDisplay}
                                    />
                                </PWTouchableOpacity>
                            ))}
                        </PWView>
                    )}
                </ScrollView>
            )}
        </PWView>
    )
}
