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

import { useCallback, useEffect, useMemo, useState } from 'react'
import { PWText, PWToolbar, PWTouchableIcon, PWView } from '@components/core'
import { AddressSearchView } from '@components/AddressSearchView'
import {
    AccountTypes,
    useAllAccounts,
    type AccountType,
} from '@perawallet/wallet-core-accounts'
import { useNetwork } from '@perawallet/wallet-core-blockchain'
import { useContacts } from '@perawallet/wallet-core-contacts'
import { useIsMultisigAddressQuery } from '@perawallet/wallet-core-multisig'
import { type Optional } from '@perawallet/wallet-core-shared'
import { useBottomSheetResult } from '@modules/bottom-sheet'
import { useLanguage } from '@hooks/useLanguage'
import { useToast } from '@hooks/useToast'
import { useStyles } from './styles'

const EXCLUDE_TYPES: AccountType[] = [AccountTypes.multisig]

export type AddParticipantContentProps = Record<string, never>

/**
 * Value the add-participant bottom sheet resolves with. `nfdName` is set
 * only when the user picked an NFD search result, so the caller can save
 * the contact under the NFD name instead of a truncated address.
 */
export type AddParticipantResult = {
    address: string
    nfdName?: string
}

export const AddParticipantContent = () => {
    const styles = useStyles()
    const { t } = useLanguage()
    const { network } = useNetwork()
    const { showToast } = useToast()
    const accounts = useAllAccounts()
    const { contacts } = useContacts()
    const [selectedAddress, setSelectedAddress] = useState('')
    const [selectedNfdName, setSelectedNfdName] = useState<Optional<string>>()
    const { resolve, dismiss } = useBottomSheetResult<AddParticipantResult>()

    const isLocalEntity = useMemo(
        () =>
            accounts.some(a => a.address === selectedAddress) ||
            contacts.some(c => c.address === selectedAddress),
        [accounts, contacts, selectedAddress],
    )

    const multisigCheck = useIsMultisigAddressQuery({
        network,
        address: selectedAddress,
        enabled: !!selectedAddress && !isLocalEntity,
    })

    useEffect(() => {
        if (!selectedAddress || multisigCheck.isFetching) return

        if (multisigCheck.data?.isMultisig) {
            showToast({
                title: t('multisig.add_participant.cannot_add_multisig_error'),
                body: t(
                    'multisig.add_participant.cannot_add_multisig_error_body',
                ),
                type: 'error',
            })
            setSelectedAddress('')
            setSelectedNfdName(undefined)
            return
        }

        resolve({ address: selectedAddress, nfdName: selectedNfdName })
        setSelectedAddress('')
        setSelectedNfdName(undefined)
    }, [
        selectedAddress,
        selectedNfdName,
        multisigCheck.data?.isMultisig,
        multisigCheck.isFetching,
        resolve,
        showToast,
        t,
    ])

    const handleSelected = useCallback(
        (address: string, nfdName?: string) => {
            const isLocal =
                accounts.some(a => a.address === address) ||
                contacts.some(c => c.address === address)
            if (isLocal) {
                resolve({ address, nfdName })
                return
            }
            setSelectedAddress(address)
            setSelectedNfdName(nfdName)
        },
        [accounts, contacts, resolve],
    )

    return (
        <PWView style={styles.container}>
            <PWToolbar
                left={
                    <PWTouchableIcon
                        name='cross'
                        variant='primary'
                        size='md'
                        onPress={dismiss}
                    />
                }
                center={
                    <PWText
                        variant='h4'
                        style={styles.title}
                    >
                        {t('multisig.add_participant.title')}
                    </PWText>
                }
                paddingStyle='dense'
            />
            <AddressSearchView
                onSelected={handleSelected}
                excludeTypes={EXCLUDE_TYPES}
                showAllContactsWhenEmpty
                inBottomSheet
                showAccountBalance
                showAddIcon
            />
        </PWView>
    )
}
