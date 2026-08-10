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

import { useEffect, useMemo, useRef, useState } from 'react'
import { AppState } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useBottomSheet } from '@modules/bottom-sheet'
import {
    useWalletConnectHandoffResolver,
    type HandoffPeerDelivery,
    type ResolverMessages,
} from '@perawallet/wallet-core-signing'
import {
    deliverApprove,
    deliverReject,
    deliverRejectInBackground,
} from '@perawallet/wallet-core-walletconnect'
import { useMultisigProposeListener } from '../../hooks/useMultisigProposeListener'
import { usePendingSignaturesSheetStore } from '../../stores/usePendingSignaturesSheetStore'
import { PendingSignaturesContent } from '../PendingSignaturesContent'

export const MultisigOverlays = () => {
    useMultisigProposeListener()
    useResolverWiring()

    const signRequestId = usePendingSignaturesSheetStore(
        state => state.signRequestId,
    )
    const closeSheet = usePendingSignaturesSheetStore(state => state.closeSheet)
    const { request: requestBottomSheet } = useBottomSheet()
    // Track open-state, not the id, so a signRequestId change while the sheet
    // is open re-renders its content instead of stacking a second sheet.
    const isSheetOpenRef = useRef(false)

    useEffect(() => {
        if (!signRequestId) return
        if (isSheetOpenRef.current) return
        isSheetOpenRef.current = true
        void (async () => {
            await requestBottomSheet<void>({
                contents: <PendingSignaturesContent />,
                options: {
                    // Fixed snap point, not 'auto': the signers list is
                    // `flex: 1` (0 natural height), so 'auto' would collapse
                    // the sheet to header + footer.
                    size: 'modal',
                    enablePanDownToClose: true,
                    autoCreateContainer: false,
                },
            })
            // Dismissed — clear the open flag and the id; the next
            // openSheet() re-fires this effect with a fresh value.
            isSheetOpenRef.current = false
            closeSheet()
        })()
    }, [signRequestId, requestBottomSheet, closeSheet])

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

    useWalletConnectHandoffResolver({ isAppActive, messages, delivery })
}
