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

import { useCallback, useState } from 'react'
import {
    useNavigation,
    useRoute,
    type RouteProp,
} from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import {
    buildAccount,
    chainAccountOf,
    findAccountByAddressOn,
    useAccountsStore,
    useAllAccounts,
    useSelectedAccountId,
} from '@perawallet/wallet-core-accounts'
import { LEGACY_CHAIN_ID } from '@perawallet/wallet-core-chain-contract'
import { useNetwork } from '@perawallet/wallet-core-chain-shared'
import { useDeviceID } from '@perawallet/wallet-core-device'
import { useDeleteMultisigInvitationMutation } from '@perawallet/wallet-core-messages'
import { multisigAdapterFor } from '@perawallet/wallet-core-multisig'
import type { Optional } from '@perawallet/wallet-core-shared'
import { useLanguage } from '@hooks/useLanguage'
import { useNavigationLock } from '@hooks/useNavigationLock'
import { useToast } from '@hooks/useToast'
import { useShouldPlayConfetti } from '@modules/onboarding'
import { getNextSharedAccountName } from '@modules/multisig'
import type { MessagesStackParamList } from '../../routes/types'

type UseMultisigInvitationNameScreenResult = {
    accountName: string
    isSaving: boolean
    isNameTaken: boolean
    nameError: Optional<string>
    isFinishDisabled: boolean
    handleNameChange: (value: string) => void
    handleFinish: () => Promise<void>
}

export const useMultisigInvitationNameScreen =
    (): UseMultisigInvitationNameScreenResult => {
        const navigation =
            useNavigation<
                NativeStackNavigationProp<
                    MessagesStackParamList,
                    'MultisigInvitationName'
                >
            >()
        const { params } =
            useRoute<
                RouteProp<MessagesStackParamList, 'MultisigInvitationName'>
            >()
        const { invitation } = params

        const { t } = useLanguage()
        const { errorToast, successToast } = useToast()
        const { network } = useNetwork()
        const deviceId = useDeviceID(network) ?? ''

        const accounts = useAllAccounts()
        const setAccounts = useAccountsStore(state => state.setAccounts)
        const { setSelectedAccountId } = useSelectedAccountId()
        const { setShouldPlayConfetti } = useShouldPlayConfetti()

        const deleteImportInboxMutation = useDeleteMultisigInvitationMutation({
            network,
            deviceId,
        })

        const [accountName, setAccountName] = useState(() =>
            getNextSharedAccountName(
                accounts,
                t('multisig.invitation.name.default_name'),
                LEGACY_CHAIN_ID,
                invitation.address,
            ),
        )
        const [isSaving, setIsSaving] = useState(false)
        const { allowProgrammaticNavigation } = useNavigationLock(isSaving)

        const trimmedName = accountName.trim()
        const normalizedName = trimmedName.toLowerCase()
        const isNameTaken =
            trimmedName !== '' &&
            accounts.some(
                a =>
                    chainAccountOf(a, LEGACY_CHAIN_ID)?.address !==
                        invitation.address &&
                    (a.name ?? '').trim().toLowerCase() === normalizedName,
            )
        const nameError = isNameTaken
            ? t('multisig.name.error_name_taken')
            : undefined
        const isFinishDisabled = isSaving || trimmedName === '' || isNameTaken

        const handleNameChange = useCallback((value: string) => {
            setAccountName(value)
        }, [])

        const handleFinish = useCallback(async () => {
            if (isSaving) return

            if (!deviceId) {
                errorToast(
                    t('multisig.invitation.title'),
                    t('multisig.invitation.accept_error'),
                )
                return
            }

            const alreadyExists = findAccountByAddressOn(
                accounts,
                LEGACY_CHAIN_ID,
                invitation.address,
            )
            if (alreadyExists) {
                errorToast(
                    t('multisig.invitation.title'),
                    t('multisig.invitation.already_added'),
                )
                return
            }

            try {
                setIsSaving(true)

                // Re-derive the address from the invitation's (version,
                // threshold, participants) and refuse to persist on mismatch.
                // The inbox backend is a relay, not a trust anchor: an address
                // that doesn't match its own participant set means the
                // invitation is corrupt or tampered. Checked before the inbox
                // delete so a bad invitation isn't consumed. Mirrors the QR
                // import path in useNameMultisigScreen.
                const adapter = multisigAdapterFor(network)
                const derivedAddress = adapter.deriveAddress({
                    version: invitation.version,
                    threshold: invitation.threshold,
                    addresses: invitation.participantAddresses,
                })
                if (derivedAddress !== invitation.address) {
                    errorToast(
                        t('multisig.import.address_mismatch_title'),
                        t('multisig.import.address_mismatch_body'),
                    )
                    return
                }

                await deleteImportInboxMutation.mutateAsync({
                    multisigAddress: invitation.address,
                })

                const newAccount = buildAccount({
                    name: trimmedName,
                    custody: { kind: 'multisig' },
                    chainId: adapter.chainId,
                    chains: {
                        [adapter.chainId]: {
                            address: derivedAddress,
                            native: adapter.toNative({
                                version: invitation.version,
                                threshold: invitation.threshold,
                                addresses: invitation.participantAddresses,
                            }),
                        },
                    },
                })

                setAccounts([...accounts, newAccount])
                setSelectedAccountId(newAccount.id)
                setShouldPlayConfetti(true)
                successToast(
                    t('multisig.invitation.accept_success'),
                    trimmedName,
                )
                allowProgrammaticNavigation()
                navigation.popToTop()
            } catch {
                errorToast(
                    t('multisig.invitation.title'),
                    t('multisig.invitation.accept_error'),
                )
            } finally {
                setIsSaving(false)
            }
        }, [
            isSaving,
            network,
            deviceId,
            accounts,
            invitation.address,
            invitation.threshold,
            invitation.participantAddresses,
            invitation.version,
            trimmedName,
            deleteImportInboxMutation,
            setAccounts,
            setSelectedAccountId,
            setShouldPlayConfetti,
            successToast,
            errorToast,
            navigation,
            allowProgrammaticNavigation,
            t,
        ])

        return {
            accountName,
            isSaving,
            isNameTaken,
            nameError,
            isFinishDisabled,
            handleNameChange,
            handleFinish,
        }
    }
