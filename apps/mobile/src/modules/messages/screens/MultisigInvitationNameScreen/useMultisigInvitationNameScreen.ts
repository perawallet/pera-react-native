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

import { useCallback, useEffect, useState } from 'react'
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
    type MultiSigAccount,
} from '@perawallet/wallet-core-accounts'
import { useNetwork } from '@perawallet/wallet-core-blockchain'
import { useDeviceID } from '@perawallet/wallet-core-device'
import { useDeleteImportInboxMutation } from '@perawallet/wallet-core-multisig'
import { useInboxInvalidator } from '@perawallet/wallet-core-messages'
import { useLanguage } from '@hooks/useLanguage'
import { useToast } from '@hooks/useToast'
import type { MessagesStackParamList } from '../../routes/types'

type UseMultisigInvitationNameScreenResult = {
    accountName: string
    isSaving: boolean
    isNameTaken: boolean
    nameError: string | undefined
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
        const { invalidate } = useInboxInvalidator()

        const accounts = useAllAccounts()
        const setAccounts = useAccountsStore(state => state.setAccounts)

        const deleteImportInboxMutation = useDeleteImportInboxMutation({
            network,
            deviceId,
        })

        const [accountName, setAccountName] = useState(
            t('multisig.invitation.name.default_name'),
        )
        const [isSaving, setIsSaving] = useState(false)

        const trimmedName = accountName.trim()
        const normalizedName = trimmedName.toLowerCase()
        const isNameTaken =
            trimmedName !== '' &&
            accounts.some(
                a => (a.name ?? '').trim().toLowerCase() === normalizedName,
            )
        const nameError = isNameTaken
            ? t('multisig.name.error_name_taken')
            : undefined
        const isFinishDisabled = isSaving || trimmedName === '' || isNameTaken

        const handleNameChange = useCallback((value: string) => {
            setAccountName(value)
        }, [])

        useEffect(() => {
            if (!isSaving) return

            const unsubscribe = navigation.addListener('beforeRemove', e => {
                e.preventDefault()
            })
            navigation.setOptions({ headerLeft: () => null })

            return () => {
                unsubscribe()
                navigation.setOptions({ headerLeft: undefined })
            }
        }, [isSaving, navigation])

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
                invalidate()
                successToast(
                    t('multisig.invitation.accept_success'),
                    trimmedName,
                )
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
            invalidate,
            successToast,
            errorToast,
            navigation,
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
