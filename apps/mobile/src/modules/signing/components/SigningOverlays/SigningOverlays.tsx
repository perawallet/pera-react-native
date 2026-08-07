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
import { AppState } from 'react-native'
import { useBottomSheet } from '@modules/bottom-sheet'
import {
    applyAppStateToHardwareSessions,
    isInteractiveSource,
    useSigningRequest,
} from '@perawallet/wallet-core-signing'
import { useSecurityStore } from '@perawallet/wallet-core-security'
import { usePreferences } from '@perawallet/wallet-core-settings'
import { TransactionRequestFAQContent } from '../TransactionRequestFAQContent'
import { useLedgerSigningDriver } from './useLedgerSigningDriver'
import { useLedgerConnectionIssueDriver } from './useLedgerConnectionIssueDriver'
import { useSigningCompletedDriver } from './useSigningCompletedDriver'
import { useSignRequestDriver } from './useSignRequestDriver'

const FAQ_SEEN_KEY = 'hasSeenTransactionRequestFAQ'

/**
 * Watches for the first transaction sign request and shows the FAQ sheet
 * via the centralized bottom sheet manager — once per device.
 */
const useTransactionRequestFAQDriver = () => {
    const { pendingSignRequests } = useSigningRequest()
    const { getPreference, setPreference } = usePreferences()
    const { request: requestBottomSheet } = useBottomSheet()
    // Same hold as useSignRequestDriver: never present the first-TX FAQ
    // sheet into the layer covered by the auto-lock overlay (PERA-4743).
    const isAppLockActive = useSecurityStore(s => s.isAppLockActive)
    const openIdRef = useRef<string | null>(null)

    useEffect(() => {
        const next = pendingSignRequests.find(
            r =>
                isInteractiveSource(r.sourceType) &&
                r.type === 'transactions' &&
                r.sourceType !== 'multisig-cosign',
        )
        if (!next) return
        if (isAppLockActive) return
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
    }, [
        pendingSignRequests,
        isAppLockActive,
        getPreference,
        setPreference,
        requestBottomSheet,
    ])
}

/**
 * Owns the `AppState` subscription for the hardware-signing backgrounding
 * policy (PERA-4637). The app layer subscribes here — where react-native
 * legitimately lives — and forwards each change to the signing package's
 * pure `applyAppStateToHardwareSessions`, so the logic package stays free of
 * react-native (which would otherwise force every signing dependent to parse
 * react-native in its tests). Mounted once via the app-root SigningOverlays.
 */
const useHardwareBackgroundPolicyDriver = () => {
    useEffect(() => {
        const subscription = AppState.addEventListener('change', nextState =>
            applyAppStateToHardwareSessions(nextState),
        )
        return () => subscription.remove()
    }, [])
}

export const SigningOverlays = () => {
    useSignRequestDriver()
    useSigningCompletedDriver()
    useTransactionRequestFAQDriver()
    useLedgerSigningDriver()
    useLedgerConnectionIssueDriver()
    useHardwareBackgroundPolicyDriver()

    return null
}
