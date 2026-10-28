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

import { useSendFunds, useSendScope } from '@modules/transactions/hooks'
import type { SendFundsStackParamList } from '@modules/transactions/routes/send-funds'
import {
    canSignWith,
    findAccountByAddressOn,
    useAccountBalancesQuery,
    useAllAccounts,
    useOnChainAccountStateQuery,
} from '@perawallet/wallet-core-accounts'
import {
    useIsNativeAssetId,
    useAssetsQuery,
} from '@perawallet/wallet-core-assets'
import { addressCodecs } from '@perawallet/wallet-core-chain-contract'
import { getChainDescriptor } from '@perawallet/wallet-core-chain-shared'
import { getArc59Config } from '@perawallet/wallet-core-config'
import { sendFlowChainAdapters } from '@perawallet/wallet-core-transactions'
import { useNavigation } from '@react-navigation/native'
import type { StackNavigationProp } from '@react-navigation/stack'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useCapability } from '@hooks/useCapability'
import { useLanguage } from '@hooks/useLanguage'
import { useToast } from '@hooks/useToast'
import { useRecipientPoisoningGate } from './useRecipientPoisoningGate'

/**
 * Given a chosen receiver address, decides the correct next send screen
 * (normal confirm / express / ARC-59 inbox) and navigates there. Shared by
 * the manual picker (`SelectDestinationScreen`) and the direct-navigation
 * path used when a deeplink already carries the destination, so the routing
 * rules live in exactly one place.
 *
 * Every receiver is first screened for address poisoning, which may ask the
 * user to confirm it. An unknown external receiver then needs an on-chain
 * opt-in lookup, so `resolveDestination` defers that case and the effect below
 * completes it once the query settles — `isResolvingDestination` is `true`
 * while screening and during the lookup so the caller can show a spinner
 * instead of the picker.
 */
export const useSendDestinationRouter = () => {
    const scope = useSendScope()
    // Opt-in routing (Express, ARC-59) lives on the send-flow adapter; a chain
    // without one lets any account receive any asset, so every send is plain.
    const requiresAssetOptIn = sendFlowChainAdapters.has(scope.chainId)
    const { selectedAssetId, setDestination, setSendMode } = useSendFunds()
    const isNativeAssetId = useIsNativeAssetId(scope)
    const accounts = useAllAccounts()
    const { accountBalances, isPending: isBalancesPending } =
        useAccountBalancesQuery(accounts, scope)
    const [pendingExternalAddress, setPendingExternalAddress] = useState<
        string | null
    >(null)

    const assetIDs = useMemo(
        () => (selectedAssetId ? [selectedAssetId] : []),
        [selectedAssetId],
    )
    const { data: assets, isFetched: isAssetFetched } = useAssetsQuery(
        scope,
        assetIDs,
    )
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
    } = useOnChainAccountStateQuery(pendingExternalAddress ?? '', scope)

    const canUseAssetInbox = useCapability({
        chain: { chainId: scope.chainId, capability: 'assetInbox' },
    })
    const { errorToast } = useToast()
    const { t } = useLanguage()
    const { screenRecipient, isScreeningRecipient } =
        useRecipientPoisoningGate()
    // A second pick while the first awaits the warning would stack another
    // sheet, and cancelling it could clear the receiver the first one set.
    const isScreeningRef = useRef(false)

    // ARC-59 needs the router contract + Pera backend, which only exist on
    // Pera-backed networks. Block the route up front instead of landing the
    // user on a summary screen that can never load.
    const routeToInbox = useCallback(() => {
        if (!canUseAssetInbox || getArc59Config(scope) === null) {
            errorToast(
                t('send_funds.destination.inbox_unavailable_title'),
                t('send_funds.destination.inbox_unavailable_body'),
            )
            return
        }
        setSendMode('sendAssetInbox')
        navigation.navigate('AssetInboxSendSummary')
    }, [canUseAssetInbox, scope, errorToast, t, setSendMode, navigation])

    useEffect(() => {
        if (!pendingExternalAddress || !selectedAsset) return

        if (!isExternalQuerySuccess && !isExternalQueryError) return

        const isReceiverOptedIn = externalAccountInfo?.holdings.some(
            holding => holding.assetId === selectedAsset.assetId,
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
        async (address: string) => {
            // A deeplink or another screen can prefill a receiver the picker
            // never validated, possibly one on another chain.
            if (!addressCodecs.get(scope.chainId).isValid(address)) {
                setDestination(undefined)
                errorToast(
                    t('send_funds.destination.invalid_address_title'),
                    t('send_funds.destination.invalid_address_body', {
                        chain: getChainDescriptor(scope.chainId).displayName,
                    }),
                )
                return
            }

            if (isScreeningRef.current) return
            // Before any route, so every kind of send gets the same warning.
            isScreeningRef.current = true
            let isApproved: boolean
            try {
                isApproved = await screenRecipient(address)
            } finally {
                isScreeningRef.current = false
            }
            if (!isApproved) {
                setDestination(undefined)
                return
            }

            setDestination(address)

            // Native-asset sends, and every send on a chain without opt-in,
            // go through the normal flow
            if (
                !requiresAssetOptIn ||
                !selectedAsset?.assetId ||
                isNativeAssetId(selectedAsset.assetId)
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
            const receiver = findAccountByAddressOn(
                accounts,
                scope.chainId,
                address,
            )
            const isLocalSignable =
                !!receiver && canSignWith(receiver, accounts, scope.chainId)

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
            requiresAssetOptIn,
            isNativeAssetId,
            selectedAsset,
            accounts,
            accountBalances,
            setSendMode,
            setDestination,
            navigation,
            routeToInbox,
            scope.chainId,
            errorToast,
            t,
            screenRecipient,
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
        (!requiresAssetOptIn ||
            isNativeAssetId(selectedAsset.assetId) ||
            !isBalancesPending)

    return {
        selectedAsset,
        resolveDestination,
        // True while the receiver is screened, and while an unknown external
        // receiver's opt-in status is resolved on-chain; navigation for the
        // latter happens in the effect once it settles.
        isResolvingDestination: isCheckingExternalOptIn || isScreeningRecipient,
        isReady,
        isAssetUnavailable,
    }
}
