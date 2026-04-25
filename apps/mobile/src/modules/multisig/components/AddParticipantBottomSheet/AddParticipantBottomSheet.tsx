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
import {
    PWBottomSheet,
    PWText,
    PWToolbar,
    PWTouchableIcon,
    PWView,
} from '@components/core'
import { AddressSearchView } from '@components/AddressSearchView'
import {
    AccountTypes,
    useAllAccounts,
    type AccountType,
} from '@perawallet/wallet-core-accounts'
import { useNetwork } from '@perawallet/wallet-core-blockchain'
import { useIsMultisigAddressQuery } from '@perawallet/wallet-core-multisig'
import { useLanguage } from '@hooks/useLanguage'
import { useToast } from '@hooks/useToast'
import { useStyles } from './styles'

const EXCLUDE_TYPES: AccountType[] = [AccountTypes.multisig]

type AddParticipantBottomSheetProps = {
    isVisible: boolean
    onClose: () => void
    onAddAddress: (address: string) => void
}

export const AddParticipantBottomSheet = ({
    isVisible,
    onClose,
    onAddAddress,
}: AddParticipantBottomSheetProps) => {
    const styles = useStyles()
    const { t } = useLanguage()
    const { network } = useNetwork()
    const { showToast } = useToast()
    const accounts = useAllAccounts()
    const [selectedAddress, setSelectedAddress] = useState('')

    const isLocalAddress = useMemo(
        () => accounts.some(a => a.address === selectedAddress),
        [accounts, selectedAddress],
    )

    const multisigCheck = useIsMultisigAddressQuery({
        network,
        address: selectedAddress,
        enabled: !!selectedAddress && !isLocalAddress,
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
            return
        }

        onAddAddress(selectedAddress)
        onClose()
        setSelectedAddress('')
    }, [
        selectedAddress,
        multisigCheck.data?.isMultisig,
        multisigCheck.isFetching,
        onAddAddress,
        onClose,
        showToast,
        t,
    ])

    const handleSelected = useCallback(
        (address: string) => {
            if (accounts.some(a => a.address === address)) {
                onAddAddress(address)
                onClose()
                return
            }
            setSelectedAddress(address)
        },
        [accounts, onAddAddress, onClose],
    )

    return (
        <PWBottomSheet
            isVisible={isVisible}
            onBackdropPress={onClose}
            size='lg'
            enablePanDownToClose
            autoCreateContainer={false}
        >
            <PWView style={styles.container}>
                <PWToolbar
                    left={
                        <PWTouchableIcon
                            name='cross'
                            variant='primary'
                            size='md'
                            onPress={onClose}
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
                />
            </PWView>
        </PWBottomSheet>
    )
}
