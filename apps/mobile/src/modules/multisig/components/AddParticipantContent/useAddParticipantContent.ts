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

import { useCallback, useEffect, useMemo, useState } from 'react'
import { AccountTypes, useAllAccounts } from '@perawallet/wallet-core-accounts'
import {
    AccountSigTypes,
    useAccountSigTypeQuery,
    useNetwork,
} from '@perawallet/wallet-core-blockchain'
import {
    ParticipantIsMultisigError,
    ParticipantIsQuantumError,
    ParticipantIsWatchError,
    useIsMultisigAddressQuery,
    type MultisigValidationError,
} from '@perawallet/wallet-core-multisig'
import type { Optional } from '@perawallet/wallet-core-shared'
import { useBottomSheetResult } from '@modules/bottom-sheet'
import { useLanguage } from '@hooks/useLanguage'
import { useToast } from '@hooks/useToast'

/**
 * Value the add-participant bottom sheet resolves with. `nfdName` is set
 * only when the user picked an NFD search result, so the caller can save
 * the contact under the NFD name instead of a truncated address.
 */
export type AddParticipantResult = {
    address: string
    nfdName?: string
}

export type UseAddParticipantContentResult = {
    handleSelected: (address: string, nfdName?: string) => void
    dismiss: () => void
}

export const useAddParticipantContent = (): UseAddParticipantContentResult => {
    const { t } = useLanguage()
    const { network } = useNetwork()
    const { errorToast } = useToast()
    const accounts = useAllAccounts()
    const [selectedAddress, setSelectedAddress] = useState('')
    const [selectedNfdName, setSelectedNfdName] = useState<Optional<string>>()
    const { resolve, dismiss } = useBottomSheetResult<AddParticipantResult>()

    const isLocalAccount = useMemo(
        () => accounts.some(a => a.address === selectedAddress),
        [accounts, selectedAddress],
    )

    const multisigCheck = useIsMultisigAddressQuery({
        network,
        address: selectedAddress,
        enabled: !!selectedAddress && !isLocalAccount,
    })

    // A post-quantum address is a hash of the PQ key — indistinguishable from
    // an Ed25519 address offline — so external addresses (QR scans included)
    // are classified by the indexer's observed sig-type. An account that never
    // signed on chain stays unknown and passes; nothing client-visible can
    // classify it.
    const sigTypeCheck = useAccountSigTypeQuery({
        address: selectedAddress,
        enabled: !!selectedAddress && !isLocalAccount,
    })

    const showValidationError = useCallback(
        (error: MultisigValidationError) => {
            if (error.code === 'participant_is_multisig') {
                errorToast(
                    t('multisig.add_participant.cannot_add_multisig_error'),
                    t(
                        'multisig.add_participant.cannot_add_multisig_error_body',
                    ),
                )
                return
            }
            if (error.code === 'participant_is_watch') {
                errorToast(
                    t('multisig.add_participant.cannot_add_watch_error'),
                    t('multisig.add_participant.cannot_add_watch_error_body'),
                )
                return
            }
            if (error.code === 'participant_is_quantum') {
                errorToast(
                    t('multisig.add_participant.cannot_add_quantum_error'),
                    t('multisig.add_participant.cannot_add_quantum_error_body'),
                )
            }
        },
        [errorToast, t],
    )

    useEffect(() => {
        if (
            !selectedAddress ||
            multisigCheck.isFetching ||
            sigTypeCheck.isFetching
        )
            return

        if (multisigCheck.data?.isMultisig) {
            showValidationError(new ParticipantIsMultisigError())
            setSelectedAddress('')
            setSelectedNfdName(undefined)
            return
        }

        if (sigTypeCheck.sigType === AccountSigTypes.pqsig) {
            showValidationError(new ParticipantIsQuantumError())
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
        sigTypeCheck.sigType,
        sigTypeCheck.isFetching,
        resolve,
        showValidationError,
    ])

    const handleSelected = useCallback(
        (address: string, nfdName?: string) => {
            const localAccount = accounts.find(a => a.address === address)
            if (localAccount) {
                if (localAccount.type === AccountTypes.watch) {
                    showValidationError(new ParticipantIsWatchError())
                    return
                }
                if (localAccount.type === AccountTypes.quantum) {
                    showValidationError(new ParticipantIsQuantumError())
                    return
                }
                resolve({ address, nfdName })
                return
            }
            // Contacts are only saved addresses — their account type is
            // unknown, so they need the same remote validation as any other
            // external address.
            setSelectedAddress(address)
            setSelectedNfdName(nfdName)
        },
        [accounts, resolve, showValidationError],
    )

    return { handleSelected, dismiss }
}
