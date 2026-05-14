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
import { useMultisigAccountDetailQuery } from '@perawallet/wallet-core-multisig'
import { useAppNavigation } from '@hooks/useAppNavigation'
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
}

export const useImportSharedAccountScreen =
    (): UseImportSharedAccountScreenResult => {
        const navigation = useAppNavigation()
        const route =
            useRoute<RouteProp<MultisigStackParamList, 'ImportSharedAccount'>>()
        const { address } = route.params

        const { network } = useNetwork()
        const accounts = useAllAccounts()

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
            navigation.push('NameMultisig', {
                address: data.address,
                threshold: data.threshold,
                addresses: data.participantAddresses,
                version: data.version,
            })
        }, [navigation, data])

        const handleRetry = useCallback(() => {
            void refetch()
        }, [refetch])

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
        }
    }
