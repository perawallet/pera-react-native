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

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import type { ExternalSignTxnTransport } from '@perawallet/wallet-core-signing'
import { useTransactionSigningHandler } from '../useTransactionSigningHandler'
import {
    TRUSTED,
    bridgeMessage,
    createMockWebview,
    injectedScript,
    languageMockValue,
} from './fixtures'

vi.mock('react-native-webview', () => ({ default: {} }))

vi.mock('@hooks/useLanguage', () => ({
    useLanguage: () => languageMockValue(),
}))

const mockShowError = vi.fn()
vi.mock('@hooks/useErrorToast', () => ({
    useErrorToast: () => ({ showError: mockShowError }),
}))

const mockResolve = vi.fn()
const mockEnqueue = vi.fn()
vi.mock('@perawallet/wallet-core-signing', () => ({
    useArc0001Resolver: () => mockResolve,
    useEnqueueArc0001SignRequest: () => mockEnqueue,
}))

const lastTransport = (): ExternalSignTxnTransport =>
    mockEnqueue.mock.calls.at(-1)?.[1] as ExternalSignTxnTransport

const txns = [{ txn: 'BASE64_TXN' }]
const metadata = { name: 'Test dApp' }
const SOURCE_URL = 'https://discover-mobile.perawallet.app/'

describe('useTransactionSigningHandler', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockResolve.mockReturnValue({ resolved: true })
    })

    const render = () => {
        const webview = createMockWebview()
        const { result } = renderHook(() =>
            useTransactionSigningHandler(webview, SOURCE_URL),
        )
        return { webview, handle: result.current }
    }

    it('enqueues the resolved group as a webview request carrying the verified origin', () => {
        const { handle } = render()

        handle(
            bridgeMessage('13', 'requestTransactionSigning', {
                txns,
                metadata,
                opts: { message: 'hi' },
            }),
            TRUSTED,
        )

        // No authorizedAddresses: the webview's trust is per-origin.
        expect(mockResolve).toHaveBeenCalledWith({
            transactions: txns,
            opts: { message: 'hi' },
        })
        expect(mockEnqueue).toHaveBeenCalledWith(
            { resolved: true },
            expect.objectContaining({
                sourceType: 'webview',
                transportId: '13',
                sourceMetadata: metadata,
                verifiedOrigin: SOURCE_URL,
            }),
        )
    })

    it('answers the ARC-0001 result array on approval', async () => {
        const { webview, handle } = render()
        handle(
            bridgeMessage('13', 'requestTransactionSigning', {
                txns,
                metadata,
            }),
            TRUSTED,
        )

        await lastTransport().respondWithResult(['c2lnbmVk', null])

        const sent = injectedScript(webview)
        expect(sent).toContain('"id":"13"')
        expect(sent).toContain('"result":["c2lnbmVk",null]')
    })

    it('answers a user reject as InternalError "User rejected"', () => {
        const { webview, handle } = render()
        handle(
            bridgeMessage('13-reject', 'requestTransactionSigning', {
                txns,
                metadata,
            }),
            TRUSTED,
        )

        lastTransport().respondWithReject()

        expect(injectedScript(webview)).toContain(
            '"error":{"code":-32603,"message":"User rejected"}',
        )
    })

    it('answers a signing failure with sanitized InternalError copy', () => {
        const { webview, handle } = render()
        handle(
            bridgeMessage('13-error', 'requestTransactionSigning', {
                txns,
                metadata,
            }),
            TRUSTED,
        )

        lastTransport().respondWithError(new Error('User rejected'))

        const sent = injectedScript(webview)
        expect(sent).toContain('"id":"13-error"')
        expect(sent).toContain(
            '"error":{"code":-32603,"message":"An error occurred during signing"}',
        )
    })

    it('maps an ARC-0001 4100 resolve failure to Unauthorized and tells the user', () => {
        const error = Object.assign(new Error('not authorized'), { code: 4100 })
        mockResolve.mockImplementation(() => {
            throw error
        })
        const { webview, handle } = render()

        handle(
            bridgeMessage('13-4100', 'requestTransactionSigning', {
                txns,
                metadata,
            }),
            TRUSTED,
        )

        expect(mockEnqueue).not.toHaveBeenCalled()
        expect(injectedScript(webview)).toContain('"code":-32001')
        expect(mockShowError).toHaveBeenCalledWith(
            error,
            'errors.signing.title',
        )
    })

    it('maps every other resolve failure to InvalidParams', () => {
        mockResolve.mockImplementation(() => {
            throw Object.assign(new Error('too many'), { code: 4201 })
        })
        const { webview, handle } = render()

        handle(
            bridgeMessage('30', 'requestTransactionSigning', {
                txns,
                metadata,
            }),
            TRUSTED,
        )

        const sent = injectedScript(webview)
        expect(sent).toContain('"id":"30"')
        expect(sent).toContain('"code":-32602')
    })

    it('answers InvalidParams when metadata is missing', () => {
        const { webview, handle } = render()

        handle(
            bridgeMessage('23', 'requestTransactionSigning', { txns }),
            TRUSTED,
        )

        expect(mockResolve).not.toHaveBeenCalled()
        expect(injectedScript(webview)).toContain('"code":-32602')
    })
})
