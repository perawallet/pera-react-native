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

import { useEffect, useMemo, useRef, useState } from 'react'
import { AppState } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useBottomSheet } from '@modules/bottom-sheet'
import {
    useWalletConnectHandoffResolver,
    type ResolverMessages,
} from '@perawallet/wallet-core-signing'
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
    // Track whether a sheet is currently presented (NOT which id) so a
    // signRequestId change while the sheet is open (e.g. the deferred-propose
    // draft → real swap) just re-renders the sheet's content in place
    // instead of stacking a second gorhom modal on top.
    const isSheetOpenRef = useRef(false)

    useEffect(() => {
        if (!signRequestId) return
        if (isSheetOpenRef.current) return
        isSheetOpenRef.current = true
        let cancelled = false
        void (async () => {
            await requestBottomSheet<void>({
                contents: <PendingSignaturesContent />,
                options: {
                    // Fixed 90% snap point gives the flex layout a definite
                    // height so the sticky footer pins below the scrollable
                    // signers list. `size: 'auto'` would size the sheet to
                    // content height, but our scroll view uses `flex: 1`
                    // which contributes 0 to natural measurement — the sheet
                    // would collapse to header + footer height. Same pattern
                    // SigningOverlays uses for its review sheet.
                    size: 'lg',
                    enablePanDownToClose: true,
                    autoCreateContainer: false,
                },
            })
            // Always reset `isSheetOpenRef` once the sheet is dismissed,
            // even on cancellation — otherwise a draft → real signRequestId
            // swap (which cancels the effect mid-await) leaves the ref
            // stuck at `true` and blocks every subsequent inbox tap from
            // ever reopening the sheet.
            isSheetOpenRef.current = false
            if (cancelled) return
            // Ensure the store is cleared if the sheet was dismissed via gesture
            // or backdrop press rather than handleClose.
            closeSheet()
        })()
        return () => {
            cancelled = true
        }
    }, [signRequestId, requestBottomSheet, closeSheet])

    return null
}

/**
 * Thin RN + i18n shell over the package-level
 * `useWalletConnectHandoffResolver`. Owns: pausing polling while the app is
 * backgrounded (a backgrounded poll would only fail and could not be
 * delivered), and building the localized message bag.
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

    useWalletConnectHandoffResolver({ isAppActive, messages })
}
