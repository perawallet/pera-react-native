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

import { useCallback, useMemo } from 'react'
import { useRoute, type RouteProp } from '@react-navigation/native'
import { useNetwork } from '@perawallet/wallet-core-blockchain'
import { useAllAccounts } from '@perawallet/wallet-core-accounts'
import {
    useMultisigAccountDetailQuery,
    useDeleteImportInboxMutation,
} from '@perawallet/wallet-core-multisig'
import { useDeviceID } from '@perawallet/wallet-core-device'
import { useAppNavigation } from '@hooks/useAppNavigation'
import { useExitAccountFlow } from '@modules/onboarding/hooks'
import type { MultisigStackParamList } from '../../routes/types'

type UseImportSharedAccountScreenResult = {
    address: string
    isLoading: boolean
    isError: boolean
    threshold: number
    participantAddresses: string[]
    totalParticipants: number
    isUserIncluded: boolean
    isAlreadyImported: boolean
    isAddDisabled: boolean
    handleAddAccount: () => void
    handleRetry: () => void
    handleDismiss: () => void
    handleIgnore: () => void
}

export const useImportSharedAccountScreen =
    (): UseImportSharedAccountScreenResult => {
        const navigation = useAppNavigation()
        const route =
            useRoute<RouteProp<MultisigStackParamList, 'ImportSharedAccount'>>()
        const { address } = route.params

        const { network } = useNetwork()
        const accounts = useAllAccounts()
        const { exitAccountFlow } = useExitAccountFlow()
        const deviceId = useDeviceID(network) ?? ''
        const deleteImportInboxMutation = useDeleteImportInboxMutation({
            network,
            deviceId,
        })

        const { data, isLoading, isError, refetch } =
            useMultisigAccountDetailQuery({ network, address })

        const participantAddresses = useMemo(
            () => data?.participantAddresses ?? [],
            [data],
        )
        const totalParticipants = participantAddresses.length
        const threshold = data?.threshold ?? 0

        const isUserIncluded = useMemo(() => {
            const participantSet = new Set(participantAddresses)
            return accounts.some(a => participantSet.has(a.address))
        }, [accounts, participantAddresses])

        const isAlreadyImported = useMemo(
            () => accounts.some(a => a.address === address),
            [accounts, address],
        )

        const isAddDisabled = isLoading || isError || isAlreadyImported || !data

        const handleAddAccount = useCallback(() => {
            if (!data) return
            // Resolving the invitation — accept or ignore — clears it from
            // the inbox on Android; fire the same fire-and-forget delete.
            if (deviceId) {
                deleteImportInboxMutation.mutate({ multisigAddress: address })
            }
            navigation.push('NameMultisig', {
                address: data.address,
                threshold: data.threshold,
                addresses: data.participantAddresses,
                version: data.version,
            })
        }, [navigation, data, deviceId, deleteImportInboxMutation, address])

        const handleRetry = useCallback(() => {
            void refetch()
        }, [refetch])

        // The screen is reached only via the shared-account-import deeplink,
        // so it has no back stack — dismissing returns to the wallet home.
        // The toolbar back arrow uses this; it does not touch the inbox
        // (Android: back ≠ Ignore).
        const handleDismiss = useCallback(() => {
            exitAccountFlow()
        }, [exitAccountFlow])

        // Mirror Android: tapping Ignore clears any matching inbox invitation
        // (fire-and-forget — a 404 when the QR scan had no inbox record is
        // expected and intentionally ignored), then leaves the flow.
        const handleIgnore = useCallback(() => {
            if (deviceId) {
                deleteImportInboxMutation.mutate({ multisigAddress: address })
            }
            exitAccountFlow()
        }, [deviceId, deleteImportInboxMutation, address, exitAccountFlow])

        return {
            address,
            isLoading,
            isError,
            threshold,
            participantAddresses,
            totalParticipants,
            isUserIncluded,
            isAlreadyImported,
            isAddDisabled,
            handleAddAccount,
            handleRetry,
            handleDismiss,
            handleIgnore,
        }
    }
