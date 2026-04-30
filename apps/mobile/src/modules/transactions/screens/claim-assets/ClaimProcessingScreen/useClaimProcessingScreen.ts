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

import { useEffect } from 'react'
import { BackHandler } from 'react-native'
import {
    useNavigation,
    useRoute,
    type RouteProp,
} from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { bottomSheetNotifier } from '@components/core'
import { useToast } from '@hooks/useToast'
import { useClaimAssets } from '@modules/transactions/hooks'
import {
    SendClaimParams,
    useTransactionSendFlow,
} from '@perawallet/wallet-core-transactions'
import { UserRejectedSigningError } from '@perawallet/wallet-core-signing'
import type { MessagesStackParamList } from '@modules/messages/routes/types'
import { useAlgodErrorMessage } from '@hooks/useAlgodErrorMessage'
import {
    useAccountBalancesInvalidator,
    useFindAccountByAddress,
} from '@perawallet/wallet-core-accounts'
import { useAppNavigation } from '@hooks/useAppNavigation'
import { useArc59Invalidator } from '@perawallet/wallet-core-asa-inbox'
import { useInboxInvalidator } from '@perawallet/wallet-core-messages'

export const useClaimProcessingScreen = () => {
    const navigation =
        useNavigation<NativeStackNavigationProp<MessagesStackParamList>>()
    const appNavigation = useAppNavigation()
    const route =
        useRoute<RouteProp<MessagesStackParamList, 'ClaimProcessing'>>()
    const { mode, assetIndex, shouldClaimAlgo } = route.params
    const { assetRequests, accountAddress, setOnFinished } = useClaimAssets()
    const account = useFindAccountByAddress(accountAddress ?? '')
    const { showToast } = useToast()
    const { getMessage } = useAlgodErrorMessage()

    const { remove: removeArc59Queries } = useArc59Invalidator()
    const { invalidate: invalidateInboxQueries } = useInboxInvalidator()
    const { invalidate: invalidateAccountBalances } =
        useAccountBalancesInvalidator()
    const { execute } = useTransactionSendFlow()

    const asset = assetRequests[assetIndex]

    useEffect(() => {
        const subscription = BackHandler.addEventListener(
            'hardwareBackPress',
            () => true,
        )

        const sendParams = {
            sendMode: mode,
            sender: account,
            asset: asset.asset,
            shouldClaimAlgo,
        } as SendClaimParams

        execute({
            params: sendParams,
        })
            .then(txId => {
                setOnFinished(() => {
                    removeArc59Queries()
                    invalidateInboxQueries()
                    invalidateAccountBalances()
                    appNavigation.replace('TabBar', {
                        screen: 'Home',
                    })
                })
                navigation.replace('ClaimSuccess', {
                    transactionId: txId,
                    variant: mode === 'claimArc59' ? 'claim' : 'reject',
                })
            })
            .catch(error => {
                if (error instanceof UserRejectedSigningError) {
                    // Silent navigation back — user already saw the overlay's cancel button.
                    navigation.goBack()
                    return
                }
                const { title, body } = getMessage(error)
                showToast(
                    {
                        title,
                        body,
                        type: 'error',
                    },
                    {
                        notifier: bottomSheetNotifier.current ?? undefined,
                    },
                )
                navigation.goBack()
            })

        return () => subscription.remove()
    }, [])
}
