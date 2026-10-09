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
import {
    findAccountByAddressOn,
    isWatchAccount,
    useAllAccounts,
} from '@perawallet/wallet-core-accounts'
import { LEGACY_CHAIN_ID } from '@perawallet/wallet-core-chain-contract'
import {
    useNetwork,
    useSelectedScope,
} from '@perawallet/wallet-core-chain-shared'
import {
    ParticipantIsMultisigError,
    ParticipantSchemeUnsupportedError,
    ParticipantIsWatchError,
    ParticipantVerdicts,
    useIsMultisigAddressQuery,
    useParticipantVerdictQuery,
    type MultisigValidationError,
} from '@perawallet/wallet-core-multisig'
import type { Optional } from '@perawallet/wallet-core-shared'
import { useBottomSheetResult } from '@modules/bottom-sheet'
import { useLanguage } from '@hooks/useLanguage'
import { useToast } from '@hooks/useToast'
import { signsWithParticipantScheme } from '../../utils/participantEligibility'

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
    const scope = useSelectedScope(LEGACY_CHAIN_ID)
    const { errorToast } = useToast()
    const accounts = useAllAccounts()
    const [selectedAddress, setSelectedAddress] = useState('')
    const [selectedNfdName, setSelectedNfdName] = useState<Optional<string>>()
    const { resolve, dismiss } = useBottomSheetResult<AddParticipantResult>()

    const isLocalAccount = useMemo(
        () =>
            !!findAccountByAddressOn(
                accounts,
                LEGACY_CHAIN_ID,
                selectedAddress,
            ),
        [accounts, selectedAddress],
    )

    const multisigCheck = useIsMultisigAddressQuery({
        network,
        address: selectedAddress,
        enabled: !!selectedAddress && !isLocalAccount,
    })

    // External addresses (QR scans included) hold no local key, so the chain
    // classifies them; one it can't classify passes.
    const verdictCheck = useParticipantVerdictQuery({
        address: selectedAddress,
        scope,
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
            verdictCheck.isFetching
        )
            return

        if (multisigCheck.data?.isMultisig) {
            showValidationError(new ParticipantIsMultisigError())
            setSelectedAddress('')
            setSelectedNfdName(undefined)
            return
        }

        if (verdictCheck.verdict === ParticipantVerdicts.incompatibleScheme) {
            showValidationError(new ParticipantSchemeUnsupportedError())
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
        verdictCheck.verdict,
        verdictCheck.isFetching,
        resolve,
        showValidationError,
    ])

    const handleSelected = useCallback(
        (address: string, nfdName?: string) => {
            const localAccount = findAccountByAddressOn(
                accounts,
                LEGACY_CHAIN_ID,
                address,
            )
            if (localAccount) {
                if (isWatchAccount(localAccount)) {
                    showValidationError(new ParticipantIsWatchError())
                    return
                }
                if (
                    !signsWithParticipantScheme(localAccount, LEGACY_CHAIN_ID)
                ) {
                    showValidationError(new ParticipantSchemeUnsupportedError())
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
