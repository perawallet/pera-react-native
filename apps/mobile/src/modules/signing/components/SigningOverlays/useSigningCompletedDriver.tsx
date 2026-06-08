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

import React, { useRef } from 'react'
import { useBottomSheet } from '@modules/bottom-sheet'
import {
    isInteractiveSource,
    useSigningEvent,
} from '@perawallet/wallet-core-signing'
import { SigningCompletedContent } from '../SigningCompletedContent'

/**
 * Subscribes to the signing event bus and shows the "transaction
 * processing" sheet via the centralized bottom sheet manager when a
 * transaction request completes with a non-proposed transport result.
 *
 * Surfaced only for externally-triggered transaction requests
 * (WalletConnect, webview, deeplink). Every internal flow owns its own
 * processing/success UI — send-funds and asset-inbox claim/reject have
 * dedicated full-screen processing screens, and swap and opt-in/out render
 * their own success UI — so the generic sheet would be redundant for them.
 * Data signing (arbitrary-data / ARC-60) is not a transaction, and multisig
 * cosign / propose completions are surfaced by PendingSignaturesContent.
 */
export const useSigningCompletedDriver = (): void => {
    const { request: requestBottomSheet } = useBottomSheet()
    const openIdRef = useRef<string | null>(null)

    useSigningEvent(
        event => event.type === 'completed',
        event => {
            if (event.type !== 'completed') return
            const req = event.request

            // Transaction-only confirmation — arbitrary-data and ARC-60
            // signing never surface this sheet.
            if (req.type !== 'transactions') return

            // Multisig cosign + multisig propose are surfaced by
            // PendingSignaturesContent — skip the generic completion sheet.
            if (req.sourceType === 'multisig-cosign') return
            if (event.result.type === 'proposed') return

            // Show only for externally-triggered requests (WalletConnect,
            // webview, deeplink). All internal flows own their own
            // processing/success UI, so this sheet would be redundant.
            if (!isInteractiveSource(req.sourceType)) return

            if (openIdRef.current === req.id) return
            openIdRef.current = req.id

            void (async () => {
                await requestBottomSheet<void>({
                    contents: <SigningCompletedContent isTransaction />,
                    options: { size: 'auto', enablePanDownToClose: true },
                })
                if (openIdRef.current === req.id) {
                    openIdRef.current = null
                }
            })()
        },
    )
}
