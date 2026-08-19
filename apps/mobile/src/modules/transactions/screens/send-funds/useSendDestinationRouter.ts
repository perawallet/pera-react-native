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

import { useSendFunds } from '@modules/transactions/hooks'
import { isAlgoAssetId } from '@perawallet/wallet-core-shared'
import type { SendFundsStackParamList } from '@modules/transactions/routes/send-funds'
import {
    canSignWith,
    useAccountBalancesQuery,
    useAllAccounts,
    useOnChainAccountInformationQuery,
} from '@perawallet/wallet-core-accounts'
import { useAssetsQuery } from '@perawallet/wallet-core-assets'
import { useNetwork } from '@perawallet/wallet-core-blockchain'
import { getArc59Config } from '@perawallet/wallet-core-config'
import { useNavigation } from '@react-navigation/native'
import { type StackNavigationProp } from '@react-navigation/stack'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLanguage } from '@hooks/useLanguage'
import { useToast } from '@hooks/useToast'

/**
 * Given a chosen receiver address, decides the correct next send screen
 * (normal confirm / express / ARC-59 inbox) and navigates there. Shared by
 * the manual picker (`SelectDestinationScreen`) and the direct-navigation
 * path used when a deeplink already carries the destination, so the routing
 * rules live in exactly one place.
 *
 * Most branches resolve synchronously. An unknown external receiver needs an
 * on-chain opt-in lookup, so `resolveDestination` defers that case and the
 * effect below completes it once the query settles — `isResolvingDestination`
 * is `true` for the duration so the caller can show a spinner instead of the
 * picker.
 */
export const useSendDestinationRouter = () => {
    const { selectedAssetId, setDestination, setSendMode } = useSendFunds()
    const accounts = useAllAccounts()
    const { accountBalances, isPending: isBalancesPending } =
        useAccountBalancesQuery(accounts)
    const [pendingExternalAddress, setPendingExternalAddress] = useState<
        string | null
    >(null)

    const assetIDs = useMemo(
        () => (selectedAssetId ? [selectedAssetId] : []),
        [selectedAssetId],
    )
    const { data: assets, isFetched: isAssetFetched } = useAssetsQuery(assetIDs)
    const selectedAsset = useMemo(() => {
        if (!selectedAssetId) return undefined
        return assets.get(selectedAssetId)
    }, [selectedAssetId, assets])

    const navigation =
        useNavigation<StackNavigationProp<SendFundsStackParamList>>()

    const {
        data: externalAccountInfo,
        isFetching: isCheckingExternalOptIn,
        isSuccess: isExternalQuerySuccess,
        isError: isExternalQueryError,
    } = useOnChainAccountInformationQuery(pendingExternalAddress ?? '')

    const { network } = useNetwork()
    const { showToast } = useToast()
    const { t } = useLanguage()

    // ARC-59 needs the router contract + Pera backend, which only exist on
    // Pera-backed networks. Block the route up front instead of landing the
    // user on a summary screen that can never load (PERA-4923).
    const routeToInbox = useCallback(() => {
        if (getArc59Config(network) === null) {
            showToast({
                title: t('send_funds.destination.inbox_unavailable_title'),
                body: t('send_funds.destination.inbox_unavailable_body'),
                type: 'error',
            })
            return
        }
        setSendMode('sendArc59')
        navigation.navigate('ARC59SendSummary')
    }, [network, showToast, t, setSendMode, navigation])

    useEffect(() => {
        if (!pendingExternalAddress || !selectedAsset) return

        if (!isExternalQuerySuccess && !isExternalQueryError) return

        const isReceiverOptedIn = externalAccountInfo?.assets.some(
            a => a.assetId === BigInt(selectedAsset.assetId),
        )

        if (isReceiverOptedIn) {
            setSendMode('normal')
            navigation.navigate('ConfirmTransaction')
        } else {
            routeToInbox()
        }

        setPendingExternalAddress(null)
    }, [
        pendingExternalAddress,
        externalAccountInfo,
        isExternalQuerySuccess,
        isExternalQueryError,
        selectedAsset,
        setSendMode,
        navigation,
        routeToInbox,
    ])

    const resolveDestination = useCallback(
        (address: string) => {
            setDestination(address)

            // ALGO sends always go through normal flow
            if (
                !selectedAsset?.assetId ||
                isAlgoAssetId(selectedAsset.assetId)
            ) {
                setSendMode('normal')
                navigation.navigate('ConfirmTransaction')
                return
            }

            // Check if receiver already holds the asset (opted in)
            const receiverBalances = accountBalances.get(address)
            const isReceiverOptedIn = receiverBalances?.assetBalances.some(
                b => b.assetId === selectedAsset.assetId,
            )

            if (isReceiverOptedIn) {
                // Receiver already opted in — normal transfer
                setSendMode('normal')
                navigation.navigate('ConfirmTransaction')
                return
            }

            // Check if receiver is a local account we can sign for
            const receiver = accounts.find(a => a.address === address)
            const isLocalSignable =
                !!receiver && canSignWith(receiver, accounts)

            if (isLocalSignable) {
                // Express send: local account, we handle opt-in + transfer
                setSendMode('express')
                navigation.navigate('ExpressSend')
                return
            }

            if (receiver) {
                routeToInbox()
                return
            }

            setPendingExternalAddress(address)
        },
        [
            selectedAsset,
            accounts,
            accountBalances,
            setSendMode,
            setDestination,
            navigation,
            routeToInbox,
        ],
    )

    // The asset query settled but the id resolved to nothing — the deeplink
    // named an ASA that isn't in the local DB (e.g. a payment request for a
    // token the user has never held). Terminal: callers must surface the
    // error state instead of waiting forever for `selectedAsset`.
    const isAssetUnavailable =
        !!selectedAssetId && isAssetFetched && !selectedAsset

    // Safe to route: the asset is known and the opt-in inputs are settled.
    // `accountBalances` is an empty Map while pending, so resolving before it
    // settles would read every local receiver as un-opted and misroute an
    // opted-in account to Express/ARC-59 (a deeplink resolves the instant this
    // mounts, so it hits that window nearly every time). ALGO needs neither
    // the asset lookup nor balances, so it's ready as soon as it resolves.
    const isReady =
        !!selectedAsset &&
        (isAlgoAssetId(selectedAsset.assetId) || !isBalancesPending)

    return {
        selectedAsset,
        resolveDestination,
        // True while an unknown external receiver's opt-in status is being
        // resolved on-chain; navigation happens in the effect once it settles.
        isResolvingDestination: isCheckingExternalOptIn,
        isReady,
        isAssetUnavailable,
    }
}
