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

import { useCallback, useEffect, useMemo, useState } from 'react'
import { AppState } from 'react-native'
import { useTranslation } from 'react-i18next'
import {
    useWalletConnectHandoffResolver,
    type HandoffPeerDelivery,
    type ResolverMessages,
} from '@perawallet/wallet-core-signing'
import {
    deliverApprove,
    deliverReject,
    deliverRejectInBackground,
    useWalletConnectStore,
} from '@perawallet/wallet-core-walletconnect'
import { useMultisigProposeListener } from '../../hooks/useMultisigProposeListener'
import { usePendingSignaturesSheetDriver } from './usePendingSignaturesSheetDriver'

export const MultisigOverlays = () => {
    useMultisigProposeListener()
    useResolverWiring()
    usePendingSignaturesSheetDriver()

    return null
}

/**
 * RN + i18n shell over `useWalletConnectHandoffResolver`: pauses polling while
 * the app is backgrounded and builds the localized message bag.
 */
const useResolverWiring = (): void => {
    const { t } = useTranslation()

    const [isAppActive, setIsAppActive] = useState(
        AppState.currentState === 'active',
    )
    useEffect(() => {
        const subscription = AppState.addEventListener('change', nextState => {
            setIsAppActive(nextState === 'active')
        })
        return () => subscription.remove()
    }, [])

    const messages = useMemo<ResolverMessages>(
        () => ({
            declined: t('multisig.sync_sign.errors.declined'),
            expired: t('multisig.sync_sign.errors.expired'),
            failed: t('multisig.sync_sign.errors.failed'),
            noTransactions: t('multisig.sync_sign.errors.no_transactions'),
            deliveryFailed: t('multisig.sync_sign.errors.delivery_failed'),
            assemblyFailed: (reason: string) =>
                t('multisig.sync_sign.errors.assembly_failed', { reason }),
        }),
        [t],
    )

    // Answers the dApp for a handoff resumed after an app kill, keyed by the
    // persisted clientId / payloadId (the in-memory closures are gone). Static —
    // the WalletConnect primitives resolve the live connector by clientId.
    const delivery = useMemo<HandoffPeerDelivery>(
        () => ({
            deliverResult: (clientId, payloadId, result) =>
                deliverApprove(clientId, payloadId, result),
            deliverSoftReject: (clientId, payloadId, error) =>
                deliverReject(clientId, payloadId, error),
            // Reject the peer without raising a connection-error banner: a
            // launch-time banner for a previous session's request would confuse.
            deliverError: (clientId, payloadId, error) => {
                deliverRejectInBackground(clientId, payloadId, error)
                return Promise.resolve()
            },
        }),
        [],
    )

    // Session-list check, read lazily per poll (no subscription): the
    // persisted connections are the source of truth for whether a session
    // exists — socket state is irrelevant, reconnects keep the entry.
    // Before rehydration the list reads empty, which would falsely cancel a
    // live handoff right after launch — report alive until hydration lands
    // (the next poll re-checks).
    const isPeerSessionAlive = useCallback((clientId: string) => {
        if (!useWalletConnectStore.persist.hasHydrated()) return true
        return useWalletConnectStore
            .getState()
            .walletConnectConnections.some(
                connection => connection.clientId === clientId,
            )
    }, [])

    useWalletConnectHandoffResolver({
        isAppActive,
        messages,
        delivery,
        isPeerSessionAlive,
    })
}
