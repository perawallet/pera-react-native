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

import React, { useEffect, useRef } from 'react'
import { useBottomSheet } from '@modules/bottom-sheet'
import {
    isInteractiveSource,
    isSignRequestAwaitingPreflight,
    useSigningRequest,
} from '@perawallet/wallet-core-signing'
import { usePreferences } from '@perawallet/wallet-core-settings'
import { TransactionRequestFAQContent } from '../TransactionRequestFAQContent'

const FAQ_SEEN_KEY = 'hasSeenTransactionRequestFAQ'

/**
 * Watches for the first transaction sign request and shows the FAQ sheet
 * via the centralized bottom sheet manager — once per device.
 */
export const useTransactionRequestFAQDriver = () => {
    const { pendingSignRequests } = useSigningRequest()
    const { getPreference, setPreference } = usePreferences()
    const { request: requestBottomSheet } = useBottomSheet()
    // No app-lock gate: BottomSheetManager holds presentation while the lock
    // overlay is up, so requesting while locked is safe.
    const openIdRef = useRef<string | null>(null)

    const candidate = pendingSignRequests.find(
        r =>
            isInteractiveSource(r.sourceType) &&
            r.type === 'transactions' &&
            r.sourceType !== 'multisig-cosign',
    )
    // Held back with the review sheet, so it opens in the same commit and
    // stacks above it, and never for a request the chain check declines.
    const next =
        candidate && !isSignRequestAwaitingPreflight(candidate)
            ? candidate
            : undefined

    useEffect(() => {
        if (!next) return
        if (openIdRef.current === next.id) return
        if (getPreference(FAQ_SEEN_KEY)) return
        openIdRef.current = next.id
        let cancelled = false
        void (async () => {
            await requestBottomSheet<void>({
                contents: <TransactionRequestFAQContent />,
                options: { size: 'auto', enablePanDownToClose: true },
            })
            if (cancelled) return
            setPreference(FAQ_SEEN_KEY, true)
            openIdRef.current = null
        })()
        return () => {
            cancelled = true
        }
    }, [next, getPreference, setPreference, requestBottomSheet])
}
