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

import { useEffect, useMemo, useRef } from 'react'
import { BackHandler } from 'react-native'

import {
    AccountTypes,
    isHardwareWalletAccount,
    resolveAuthAccount,
    useAccountBalancesInvalidator,
    useAllAccounts,
    useSelectedAccount,
} from '@perawallet/wallet-core-accounts'
import { useAssetsQuery } from '@perawallet/wallet-core-assets'
import {
    type SendTransactionParams,
    useTransactionSendFlow,
} from '@perawallet/wallet-core-transactions'
import {
    UserRejectedSigningError,
    useSigningEvent,
} from '@perawallet/wallet-core-signing'
import { useNavigation } from '@react-navigation/native'
import type { StackNavigationProp } from '@react-navigation/stack'
import { bottomSheetNotifier } from '@components/core'
import { useSendFunds } from '@modules/transactions/hooks'
import { trackEvent, TransactionsEvent, AnalyticsMetadataKey } from '@analytics'
import { useErrorToast } from '@hooks/useErrorToast'
import type { SendFundsStackParamList } from '../../../routes/send-funds/types'

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
        const allAccounts = useAllAccounts()
        const { showError } = useErrorToast()
        const { invalidate: invalidateAccountBalances } =
            useAccountBalancesInvalidator()

        const { execute } = useTransactionSendFlow()

        // Multisig propose returns via the `proposed` transport result instead
        // of resolving the algod submission Promise — `execute()` never settles
        // in that case. Subscribe to the signing event bus and exit the
        // send-funds flow so the PendingSignaturesBottomSheet (opened by
        // useMultisigProposeListener on the same event) can take over.
        const hasExitedRef = useRef(false)
        const proposeReceivedRef = useRef(false)

        useSigningEvent(
            event =>
                event.type === 'transport-result' &&
                event.result.type === 'proposed',
            () => {
                proposeReceivedRef.current = true
                if (hasExitedRef.current) return
                if (!onFinished) return
                hasExitedRef.current = true
                onFinished()
            },
        )

        useEffect(() => {
            // Re-fire when onFinished becomes available after a propose event
            // arrived early — avoids stranding the screen with a consumed
            // propose result.
            if (!proposeReceivedRef.current) return
            if (hasExitedRef.current) return
            if (!onFinished) return
            hasExitedRef.current = true
            onFinished()
        }, [onFinished])

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
                    trackEvent(TransactionsEvent.Complete, {
                        [AnalyticsMetadataKey.AssetId]: selectedAssetId ?? '',
                        [AnalyticsMetadataKey.Amount]: amount?.toNumber() ?? 0,
                        [AnalyticsMetadataKey.TransactionId]: txId,
                        [AnalyticsMetadataKey.AccountType]:
                            selectedAccount?.type,
                    })
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
            // Submits the transaction exactly once on mount; re-running on any
            // param change would re-send. Intentional empty dependency array.
            // eslint-disable-next-line react-hooks/exhaustive-deps
        }, [])

        // The device prompt comes from the account that actually signs — the
        // AUTH account for rekeyed senders (rekeyed-to-Ledger, undo-rekey) —
        // so the processing copy must match the machine-driven Ledger
        // overlay. A broken rekey chain falls back to the sender itself.
        const signingAccount = useMemo(() => {
            if (!selectedAccount) return undefined
            try {
                return resolveAuthAccount(selectedAccount, allAccounts)
            } catch {
                return selectedAccount
            }
        }, [selectedAccount, allAccounts])

        const isHardwareSender = signingAccount?.type === AccountTypes.hardware
        const hardwareDeviceName =
            signingAccount && isHardwareWalletAccount(signingAccount)
                ? (signingAccount.hardwareDetails.deviceName ?? null)
                : null

        return { isHardwareSender, hardwareDeviceName }
    }
