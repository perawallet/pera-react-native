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

import { useCallback, useState } from 'react'
import {
    useNavigation,
    useRoute,
    type RouteProp,
} from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import {
    AccountTypes,
    useAccountsStore,
    useAllAccounts,
    useSelectedAccountAddress,
    type MultiSigAccount,
} from '@perawallet/wallet-core-accounts'
import { useNetwork } from '@perawallet/wallet-core-blockchain'
import { useDeviceID } from '@perawallet/wallet-core-device'
import { useDeleteMultisigInvitationMutation } from '@perawallet/wallet-core-messages'
import { useLanguage } from '@hooks/useLanguage'
import { useNavigationLock } from '@hooks/useNavigationLock'
import { useToast } from '@hooks/useToast'
import { useShouldPlayConfetti } from '@modules/onboarding/hooks'
import { getNextSharedAccountName } from '@modules/multisig/utils'
import type { MessagesStackParamList } from '../../routes/types'
import { Optional } from '@perawallet/wallet-core-shared'

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
        const { setSelectedAccountAddress } = useSelectedAccountAddress()
        const { setShouldPlayConfetti } = useShouldPlayConfetti()

        const deleteImportInboxMutation = useDeleteMultisigInvitationMutation({
            network,
            deviceId,
        })

        const [accountName, setAccountName] = useState(() =>
            getNextSharedAccountName(
                accounts,
                t('multisig.invitation.name.default_name'),
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
                    a.address !== invitation.address &&
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

            const alreadyExists = accounts.some(
                a => a.address === invitation.address,
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

                await deleteImportInboxMutation.mutateAsync({
                    multisigAddress: invitation.address,
                })

                const newAccount: MultiSigAccount = {
                    type: AccountTypes.multisig,
                    address: invitation.address,
                    name: trimmedName,
                    multisigDetails: {
                        threshold: invitation.threshold,
                        addresses: invitation.participantAddresses,
                    },
                }

                setAccounts([...accounts, newAccount])
                setSelectedAccountAddress(invitation.address)
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
            deviceId,
            accounts,
            invitation.address,
            invitation.threshold,
            invitation.participantAddresses,
            trimmedName,
            deleteImportInboxMutation,
            setAccounts,
            setSelectedAccountAddress,
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
