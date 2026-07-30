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

import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
    approve: vi.fn(),
    reject: vi.fn(),
    useDappRequest: vi.fn(),
    useSigningAccounts: vi.fn(),
    useSelectedAccountAddress: vi.fn(),
}))

vi.mock('../../../hooks/useDappRequest', () => ({
    useDappRequest: mocks.useDappRequest,
}))

vi.mock('@perawallet/wallet-core-accounts', () => ({
    useSigningAccounts: mocks.useSigningAccounts,
    useSelectedAccountAddress: mocks.useSelectedAccountAddress,
}))

import { useWcConnectScreen } from '../useWcConnectScreen'

const ACCOUNT_A = { address: 'AAAA', name: 'Account A' }
const ACCOUNT_B = { address: 'BBBB', name: 'Account B' }

const wcConnectApproval = (
    overrides: Record<string, unknown> = {},
): Record<string, unknown> => ({
    kind: 'wc-connect',
    requestId: 'wc-wc-connect-client-1',
    clientId: 'client-1',
    chainId: 416_002,
    origin: 'https://dapp.example',
    peerName: 'Test dApp',
    peerIcons: ['https://dapp.example/icon.png'],
    permissions: ['algo_signTxn'],
    ...overrides,
})

const render = (approval: unknown = wcConnectApproval()) => {
    mocks.useDappRequest.mockReturnValue({
        approval,
        isLoading: false,
        approve: mocks.approve,
        reject: mocks.reject,
    })
    return renderHook(() => useWcConnectScreen())
}

describe('useWcConnectScreen', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.useSigningAccounts.mockReturnValue([ACCOUNT_A, ACCOUNT_B])
        mocks.useSelectedAccountAddress.mockReturnValue({
            selectedAccountAddress: null,
        })
    })

    it('shapes the approval into what the shared header consumes', () => {
        const { result } = render()

        expect(result.current.request).toEqual({
            clientId: 'client-1',
            chainId: 416_002,
            permissions: ['algo_signTxn'],
            peerMeta: {
                name: 'Test dApp',
                url: 'https://dapp.example',
                icons: ['https://dapp.example/icon.png'],
                description: '',
            },
        })
    })

    it('falls back to the origin when the peer asserted no name', () => {
        // peerMeta.name is optional in WC v1; an empty header title would read
        // as "  wants to connect to your account".
        const { result } = render(wcConnectApproval({ peerName: undefined }))

        expect(result.current.request?.peerMeta.name).toBe(
            'https://dapp.example',
        )
    })

    it('lists no permissions rather than inventing a full set when the message carries none', () => {
        // Showing more than the dApp asked for would misrepresent the grant.
        const { result } = render(wcConnectApproval({ permissions: undefined }))

        expect(result.current.request?.permissions).toEqual([])
    })

    it('cannot connect until an account is picked, then approves with exactly those accounts', () => {
        const { result } = render()

        expect(result.current.canConnect).toBe(false)

        act(() => {
            result.current.toggle('BBBB')
        })
        expect(result.current.canConnect).toBe(true)

        act(() => {
            result.current.handleConnect()
        })
        expect(mocks.approve).toHaveBeenCalledWith(['BBBB'])
    })

    it('never approves an empty grant even if the handler is invoked directly', () => {
        const { result } = render()

        act(() => {
            result.current.handleConnect()
        })

        expect(mocks.approve).not.toHaveBeenCalled()
    })

    it('toggles a selected account back off', () => {
        const { result } = render()

        act(() => {
            result.current.toggle('AAAA')
        })
        act(() => {
            result.current.toggle('AAAA')
        })

        expect(result.current.canConnect).toBe(false)
    })

    it('seeds the selection with the active account when it can sign', () => {
        mocks.useSelectedAccountAddress.mockReturnValue({
            selectedAccountAddress: 'BBBB',
        })
        const { result } = render()

        expect(result.current.selected.has('BBBB')).toBe(true)
        expect(result.current.canConnect).toBe(true)
    })

    it('pre-checks nothing when the active account cannot sign', () => {
        // A watch-only active account would otherwise arrive pre-selected and
        // fail on approve.
        mocks.useSelectedAccountAddress.mockReturnValue({
            selectedAccountAddress: 'ZZZZ',
        })
        const { result } = render()

        expect(result.current.canConnect).toBe(false)
    })

    it('rejects on cancel', () => {
        const { result } = render()

        act(() => {
            result.current.handleCancel()
        })

        expect(mocks.reject).toHaveBeenCalledTimes(1)
        expect(mocks.approve).not.toHaveBeenCalled()
    })

    it('surfaces the browser-verified requester origin untouched', () => {
        const { result } = render(
            wcConnectApproval({ requesterOrigin: 'https://real-tab.example' }),
        )

        expect(result.current.requesterOrigin).toBe('https://real-tab.example')
    })

    describe('requester origin vs the peer’s own url claim', () => {
        it('treats a matching origin as not distinct, so the header shows only the badge', () => {
            const { result } = render(
                wcConnectApproval({
                    origin: 'https://dapp.example',
                    requesterOrigin: 'https://dapp.example',
                }),
            )

            expect(result.current.isRequesterOriginDistinct).toBe(false)
        })

        it('ignores a path or trailing slash on the peer url when comparing', () => {
            // peerMeta.url routinely carries a path while requesterOrigin is
            // always bare. Comparing raw strings would call this a mismatch and
            // put the duplicated origin line back on every normal connection —
            // the exact thing this change removes.
            for (const peerUrl of [
                'https://dapp.example/',
                'https://dapp.example/connect?x=1',
                'https://dapp.example:443/deep/path#frag',
            ]) {
                const { result } = render(
                    wcConnectApproval({
                        origin: peerUrl,
                        requesterOrigin: 'https://dapp.example',
                    }),
                )
                expect(result.current.isRequesterOriginDistinct).toBe(false)
            }
        })

        it('reports a genuinely different origin as distinct, so the spoof stays visible', () => {
            // The security case: a page can pair while asserting someone
            // else's peerMeta.url. The badge must not silently vouch for it.
            const { result } = render(
                wcConnectApproval({
                    origin: 'https://trusted-looking.example',
                    requesterOrigin: 'https://evil.example',
                }),
            )

            expect(result.current.isRequesterOriginDistinct).toBe(true)
        })

        it('treats a different port or scheme as distinct', () => {
            for (const peerUrl of [
                'https://dapp.example:8443',
                'http://dapp.example',
            ]) {
                const { result } = render(
                    wcConnectApproval({
                        origin: peerUrl,
                        requesterOrigin: 'https://dapp.example',
                    }),
                )
                expect(result.current.isRequesterOriginDistinct).toBe(true)
            }
        })

        it('treats an unparseable peer url as distinct rather than vouching for it', () => {
            const { result } = render(
                wcConnectApproval({
                    origin: 'not a url',
                    requesterOrigin: 'https://real-tab.example',
                }),
            )

            expect(result.current.isRequesterOriginDistinct).toBe(true)
        })

        it('is never distinct when there is no requester origin to compare', () => {
            // Nothing to show and nothing to contradict — the header renders no
            // requester row at all in this case.
            expect(render().result.current.isRequesterOriginDistinct).toBe(
                false,
            )
        })
    })

    it('reports no requester origin for a user-initiated pairing', () => {
        // A pasted URI / QR scan has no requesting tab — the header must not
        // then claim a verified origin.
        expect(render().result.current.requesterOrigin).toBeUndefined()
    })

    it('builds no request for an approval of another kind', () => {
        expect(
            render({
                kind: 'enable',
                requestId: 'x',
                origin: 'https://x.example',
            }).result.current.request,
        ).toBe(null)
    })
})
