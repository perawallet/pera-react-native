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

import React, { useRef } from 'react'
import { useBottomSheet } from '@modules/bottom-sheet'
import {
    isInteractiveSource,
    useSigningEvent,
    type SignRequest,
} from '@perawallet/wallet-core-signing'
import { useConnectionsStore } from '@perawallet/wallet-core-connections'
import type { ConnectionOrigin } from '@perawallet/wallet-extension-connections'
import { getPreferredDappIcon } from '@modules/walletconnect/utils/dapp-icon'
import { SigningCompletedContent } from '../SigningCompletedContent'
import type { SigningReturnToDapp } from '../SigningCompletedContent/useSigningCompletedContent'

/**
 * How this request's session was paired; undefined for non-connection requests
 * and connections with no recorded origin. Read off the connection record via
 * `transportId` (the `Connection.id`), not the legacy `dappOrigins` side-table.
 */
const resolveSessionOrigin = (
    req: SignRequest,
): ConnectionOrigin | undefined =>
    req.sourceType === 'walletconnect' && req.transportId
        ? useConnectionsStore
              .getState()
              .connections.find(connection => connection.id === req.transportId)
              ?.origin
        : undefined

/** Only external-browser sessions get the "Return to the dApp" hand-off. */
const resolveReturnToDapp = (
    req: SignRequest,
): SigningReturnToDapp | undefined => {
    const origin = resolveSessionOrigin(req)
    if (origin?.source !== 'external-browser') return undefined
    return {
        browserName: origin.browserName,
        dappName: req.sourceMetadata?.name,
        dappIconUrl: getPreferredDappIcon(req.sourceMetadata?.icons),
    }
}

// The generic "transaction processing" sheet, only for externally-triggered
// transaction requests; every internal flow owns its own processing/success UI.
export const useSigningCompletedDriver = (): void => {
    const { request: requestBottomSheet } = useBottomSheet()
    const openIdRef = useRef<string | null>(null)

    useSigningEvent(
        event => event.type === 'completed',
        event => {
            if (event.type !== 'completed') return
            const req = event.request

            // Arbitrary-data and ARC-60 signing are not transactions.
            if (req.type !== 'transactions') return

            // Multisig cosign and propose completions are surfaced by PendingSignaturesContent.
            if (req.sourceType === 'multisig-cosign') return
            if (event.result.type === 'proposed') return

            if (!isInteractiveSource(req.sourceType)) return

            // In-app dApps are right behind this sheet and show their own
            // confirmation: skip for webview-bridge signing and for WC
            // sessions that were paired inside the in-app browser.
            if (req.sourceType === 'webview') return
            if (resolveSessionOrigin(req)?.source === 'in-app') return

            if (openIdRef.current === req.id) return
            openIdRef.current = req.id

            void (async () => {
                await requestBottomSheet<void>({
                    contents: (
                        <SigningCompletedContent
                            isTransaction
                            returnToDapp={resolveReturnToDapp(req)}
                        />
                    ),
                    options: { size: 'auto', enablePanDownToClose: true },
                })
                if (openIdRef.current === req.id) {
                    openIdRef.current = null
                }
            })()
        },
    )
}
