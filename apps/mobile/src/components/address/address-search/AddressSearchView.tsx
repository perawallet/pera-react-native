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

import PWView from '../../common/view/PWView'
import { useStyles } from './styles'

import { useMemo, useState } from 'react'
import { Text } from '@rneui/themed'
import AddressEntryField from '../address-entry/AddressEntryField'
import { truncateAlgorandAddress } from '@perawallet/wallet-core-shared'
import { useContacts } from '@perawallet/wallet-core-contacts'
import { useAllAccounts } from '@perawallet/wallet-core-accounts'
import { isValidAlgorandAddress } from '@perawallet/wallet-core-blockchain'
import { ScrollView } from 'react-native'
import PWTouchableOpacity from '../../common/touchable-opacity/PWTouchableOpacity'
import AccountDisplay from '../../accounts/account-display/AccountDisplay'
import EmptyView from '../../common/empty-view/EmptyView'
import AddressDisplay from '../address-display/AddressDisplay'
import PWIcon from '../../common/icons/PWIcon'
import { useLanguage } from '../../../hooks/language'

type AddressSearchViewProps = {
    onSelected: (address: string) => void
}

const AddressSearchView = ({ onSelected }: AddressSearchViewProps) => {
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
                            <Text
                                h4
                                h4Style={styles.title}
                            >
                                {t('address_entry.address')}
                            </Text>
                            <Text>{truncateAlgorandAddress(value)}</Text>
                        </PWTouchableOpacity>
                    )}
                    {!!matchingContacts.length && (
                        <PWView style={styles.section}>
                            <Text
                                h4
                                h4Style={styles.title}
                            >
                                {t('address_entry.contacts')}
                            </Text>
                            {matchingContacts.map(c => (
                                <PWTouchableOpacity
                                    key={`contact-${c.address}`}
                                    onPress={() => onSelected(c.address)}
                                >
                                    {/* TODO: probably inefficient to use AddressDisplay - maybe we need a ContactItem or something */}
                                    <AddressDisplay
                                        address={c.address}
                                        showCopy={false}
                                    />
                                </PWTouchableOpacity>
                            ))}
                        </PWView>
                    )}
                    {!!matchingAccounts.length && (
                        <PWView style={styles.section}>
                            <Text
                                h4
                                h4Style={styles.title}
                            >
                                {t('address_entry.my_accounts')}
                            </Text>
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

export default AddressSearchView
