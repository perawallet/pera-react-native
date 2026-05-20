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

import { useEffect, useMemo, useRef } from 'react'
import { BackHandler } from 'react-native'

import { bottomSheetNotifier } from '@components/core'
import { useSendFunds } from '@modules/transactions/hooks'
import {
    useAccountBalancesInvalidator,
    useSelectedAccount,
} from '@perawallet/wallet-core-accounts'
import { useAssetsQuery } from '@perawallet/wallet-core-assets'
import {
    SendTransactionParams,
    useTransactionSendFlow,
} from '@perawallet/wallet-core-transactions'
import {
    UserRejectedSigningError,
    useLastTransportResult,
    type TransportResult,
} from '@perawallet/wallet-core-signing'
import { useNavigation } from '@react-navigation/native'
import type { StackNavigationProp } from '@react-navigation/stack'
import type { SendFundsStackParamList } from '../../../routes/send-funds/types'
import { useErrorToast } from '@hooks/useErrorToast'
import {
    AccountTypes,
    isHardwareWalletAccount,
} from '@perawallet/wallet-core-accounts'

export type UseTransactionProcessingScreenResult = {
    /** True when the sender is a hardware-wallet account; selects copy. */
    isHardwareSender: boolean
    /** The hardware device's display name when known, otherwise null. */
    hardwareDeviceName: string | null
}

export const useTransactionProcessingScreen =
    (): UseTransactionProcessingScreenResult => {
        const navigation =
            useNavigation<StackNavigationProp<SendFundsStackParamList>>()
        const {
            selectedAssetId,
            amount,
            destination,
            note,
            sendMode,
            arc59Summary,
            isCloseAccount,
            onFinished,
        } = useSendFunds()

        const assetIDs = useMemo(
            () => (selectedAssetId ? [selectedAssetId] : []),
            [selectedAssetId],
        )
        const { data: assets } = useAssetsQuery(assetIDs)
        const selectedAsset = useMemo(() => {
            if (!selectedAssetId) return undefined
            return assets.get(selectedAssetId)
        }, [selectedAssetId, assets])
        const selectedAccount = useSelectedAccount()
        const { showError } = useErrorToast()
        const { invalidate: invalidateAccountBalances } =
            useAccountBalancesInvalidator()

        const { execute } = useTransactionSendFlow()

        // Multisig propose returns via the `proposed` transport result instead of
        // resolving the algod submission Promise — `execute()` never settles in
        // that case. Watch `lastTransportResult` from the signing store (set
        // unconditionally by the actor lifecycle on completion) and exit the
        // send-funds flow so the PendingSignaturesBottomSheet (opened by
        // useMultisigProposeListener on the same store change) can take over.
        //
        // We don't use `useSigningPipeline({ onEvent })` here: its actor
        // subscription doesn't reliably establish in time for headless propose
        // requests, because the lifecycle's actor map is non-reactive.
        const lastTransportResult = useLastTransportResult()
        const seenTransportResultRef = useRef<TransportResult | null>(
            lastTransportResult ?? null,
        )
        const hasExitedRef = useRef(false)

        useEffect(() => {
            if (lastTransportResult === seenTransportResultRef.current) return
            // Non-proposed (or null) results are noise for this screen; mark seen
            // and bail without consuming the proposed-exit budget.
            if (!lastTransportResult) {
                seenTransportResultRef.current = null
                return
            }
            if (lastTransportResult.type !== 'proposed') {
                seenTransportResultRef.current = lastTransportResult
                return
            }
            if (hasExitedRef.current) return
            // Defer until onFinished resolves — don't update seenRef yet so the
            // effect re-fires when onFinished becomes available. Avoids a bug
            // where the screen "consumes" a proposed result without exiting,
            // permanently leaving the sheet visible.
            if (!onFinished) return
            seenTransportResultRef.current = lastTransportResult
            hasExitedRef.current = true
            onFinished()
        }, [lastTransportResult, onFinished])

        useEffect(() => {
            const subscription = BackHandler.addEventListener(
                'hardwareBackPress',
                () => true,
            )

            const sendParams = {
                sendMode,
                sender: selectedAccount,
                receiver: destination,
                asset: selectedAsset,
                amount,
                note,
                isCloseAccount,
                arc59Summary,
            } as SendTransactionParams

            execute({
                params: sendParams,
            })
                .then(txId => {
                    invalidateAccountBalances()
                    navigation.replace('TransactionSuccess', {
                        transactionId: txId,
                    })
                })
                .catch(error => {
                    if (error instanceof UserRejectedSigningError) {
                        // Silent navigation back — user already saw the overlay's cancel button.
                        navigation.goBack()
                        return
                    }
                    showError(error, undefined, {
                        notifier: bottomSheetNotifier.current ?? undefined,
                    })
                    navigation.goBack()
                })

            return () => subscription.remove()
        }, [])

        const isHardwareSender = selectedAccount?.type === AccountTypes.hardware
        const hardwareDeviceName =
            selectedAccount && isHardwareWalletAccount(selectedAccount)
                ? (selectedAccount.hardwareDetails.deviceName ?? null)
                : null

        return { isHardwareSender, hardwareDeviceName }
    }
