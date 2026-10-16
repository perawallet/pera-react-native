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

// The in-app browser's sign bridge, end to end: a page's ARC-0001 group goes
// through the resolver, the review sheet and the signing pipeline, and the page
// is answered with the signed transaction for the bytes it sent.

import React, { useEffect, useRef } from 'react'
import {
    afterAll,
    afterEach,
    beforeAll,
    beforeEach,
    describe,
    expect,
    it,
    vi,
    type MockInstance,
} from 'vitest'
import { decodeSignedTransaction } from 'algosdk'
import { useAccountsStore } from '@perawallet/wallet-core-accounts'
import {
    mockAlgodAccountInformation,
    mockAlgodTransactionParams,
} from '@perawallet/wallet-core-chain-algorand/test-handlers'
import { encodeTransactionRaw } from '@perawallet/wallet-core-chain-algorand/blockchain'
import {
    decodeFromBase64,
    encodeToBase64,
} from '@perawallet/wallet-core-shared'
import { usePreferences } from '@perawallet/wallet-core-settings'
import { getProvider } from '@perawallet/wallet-extension-provider'
import { SigningOverlays } from '@modules/signing/shell'
import { useTransactionSigningHandler } from '@modules/webview/hooks/bridge/useTransactionSigningHandler'
import {
    bridgeMessage,
    createMockWebview,
    type MockWebview,
} from '@modules/webview/hooks/bridge/__tests__/fixtures'
import { server } from '@test-utils/msw-server'
import { resetTestKeystore } from '@test-utils/algorand-keystore-test'
import {
    resetTestDatabase,
    seedAlgoAsset,
    setupTestDatabase,
    teardownTestDatabase,
} from '@test-utils/database-setup'
import { renderWithNavigation } from '@test-utils/renderWithNavigation'
import {
    REVIEW_RECEIVER_ADDRESS,
    REVIEW_SIGNER_ADDRESS,
    buildPaymentTransaction,
    drainPendingSignRequests,
    fireEvent,
    screen,
    seedAlgo25Signer,
    waitFor,
} from '@test-utils/signing-review'

const PAGE_URL = 'https://discover-mobile.perawallet.app/'
// The in-memory keystore signs with 64 zero bytes, which the canonical
// encoding drops; a visible signature survives delivery.
const VISIBLE_SIGNATURE = new Uint8Array(64).fill(7)

type BridgeHandle = { current: (message: unknown) => void }

const renderBrowserBridge = (webview: MockWebview) => {
    const handle: BridgeHandle = { current: () => {} }
    const Host = () => {
        const { setPreference } = usePreferences()
        const handler = useTransactionSigningHandler(webview, PAGE_URL)
        const prepared = useRef(false)
        handle.current = handler as BridgeHandle['current']
        useEffect(() => {
            if (prepared.current) return
            prepared.current = true
            setPreference('hasSeenTransactionRequestFAQ', true)
        }, [setPreference])
        return <SigningOverlays />
    }
    renderWithNavigation(Host, 'BrowserBridgeHost')
    return handle
}

// The page's answer, as `window.postMessage` delivered it.
const answerTo = (webview: MockWebview, id: string): unknown => {
    for (const [script] of webview.injectJavaScript.mock.calls) {
        const json = String(script)
            .replace(/^window\.postMessage\(/, '')
            .replace(/\);$/, '')
        const message = JSON.parse(json) as { id?: string; result?: unknown }
        if (message.id === id) return message.result
    }
    return undefined
}

describe('Flow: in-app browser sign bridge → review → signed answer', () => {
    let signSpy: MockInstance

    beforeAll(async () => {
        await setupTestDatabase()
    })
    afterAll(async () => {
        await teardownTestDatabase()
    })

    beforeEach(async () => {
        drainPendingSignRequests()
        await resetTestDatabase()
        await seedAlgoAsset('mainnet')
        resetTestKeystore()
        useAccountsStore.getState().setAccounts([])
        signSpy = vi
            .spyOn(getProvider().key.store, 'sign')
            .mockResolvedValue(VISIBLE_SIGNATURE)
        server.use(
            mockAlgodTransactionParams({ response: { fee: 1000 } }),
            mockAlgodAccountInformation({
                address: REVIEW_SIGNER_ADDRESS,
                response: { amount: 5_000_000, 'min-balance': 100_000 },
            }),
        )
    })

    afterEach(() => {
        signSpy.mockRestore()
    })

    it('Given a page asks to sign a payment, when the user confirms the review, then the page is answered with that payment signed', async () => {
        await seedAlgo25Signer()
        const webview = createMockWebview()
        const handle = renderBrowserBridge(webview)
        const requested = encodeToBase64(
            encodeTransactionRaw(
                buildPaymentTransaction({
                    sender: REVIEW_SIGNER_ADDRESS,
                    receiver: REVIEW_RECEIVER_ADDRESS,
                }),
            ),
        )

        handle.current(
            bridgeMessage('bridge-1', 'signTransactions', {
                txns: [{ txn: requested }],
                metadata: { name: 'Test page' },
            }),
        )

        await waitFor(
            () => {
                expect(screen.getByTestId('signing-confirm-slide')).toBeTruthy()
            },
            { timeout: 10_000 },
        )
        fireEvent.click(screen.getByTestId('signing-confirm-slide'))

        await waitFor(
            () => {
                expect(answerTo(webview, 'bridge-1')).toBeDefined()
            },
            { timeout: 10_000 },
        )
        const [slot] = answerTo(webview, 'bridge-1') as string[]
        const signed = decodeSignedTransaction(decodeFromBase64(slot))
        expect(encodeToBase64(encodeTransactionRaw(signed.txn))).toBe(requested)
        expect(signed.sig).toEqual(VISIBLE_SIGNATURE)
    })
})
