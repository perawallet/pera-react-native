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

import { Linking } from 'react-native'
import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
    approve: vi.fn(),
    reject: vi.fn(),
    useDappRequest: vi.fn(),
    useSigningAccounts: vi.fn(),
    useSelectedAccountId: vi.fn(),
    useApprovalArming: vi.fn(),
}))

vi.mock('../../../hooks/useDappRequest.web', () => ({
    useDappRequest: mocks.useDappRequest,
}))

vi.mock('@hooks/useApprovalArming.web', () => ({
    useApprovalArming: mocks.useApprovalArming,
}))

vi.mock('@perawallet/wallet-core-accounts', () => ({
    useSigningAccounts: mocks.useSigningAccounts,
    useSelectedAccountId: mocks.useSelectedAccountId,
    chainAccountOf: (
        account: { chains: Record<string, unknown> },
        id: string,
    ) => account.chains[id],
}))

import { useWcConnectScreen } from '../useWcConnectScreen'

const ACCOUNT_A = {
    id: 'account-a',
    name: 'Account A',
    custody: { kind: 'local', seed: null },
    chains: { algorand: { address: 'AAAA', keyPairId: 'key-a' } },
}
const ACCOUNT_B = {
    id: 'account-b',
    name: 'Account B',
    custody: { kind: 'local', seed: null },
    chains: { algorand: { address: 'BBBB', keyPairId: 'key-b' } },
}

const PEER = {
    name: 'Test dApp',
    url: 'https://dapp.example',
    icons: ['https://dapp.example/icon.png'],
}

const proposalApproval = (
    overrides: Record<string, unknown> = {},
): Record<string, unknown> => ({
    kind: 'connection-proposal',
    requestId: 'connection-proposal-1',
    proposalId: 'proposal-1',
    connectionKind: 'walletconnect-v1',
    origin: 'https://dapp.example',
    peer: PEER,
    requested: { networks: ['mainnet'], methods: ['algo_signTxn'] },
    expiresAt: Date.now() + 60_000,
    ...overrides,
})

const render = (approval: unknown = proposalApproval()) => {
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
        mocks.useSelectedAccountId.mockReturnValue({
            selectedAccountId: null,
        })
        mocks.useApprovalArming.mockReturnValue(true)
    })

    it('exposes the proposal peer and its requested methods as the permissions list', () => {
        const { result } = render()

        expect(result.current.peer).toEqual(PEER)
        expect(result.current.permissions).toEqual(['algo_signTxn'])
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
        mocks.useSelectedAccountId.mockReturnValue({
            selectedAccountId: 'account-b',
        })
        const { result } = render()

        expect(result.current.selected.has('BBBB')).toBe(true)
        expect(result.current.canConnect).toBe(true)
    })

    it('seeds once the account store rehydrates after the proposal', () => {
        mocks.useSelectedAccountId.mockReturnValue({
            selectedAccountId: 'account-b',
        })
        mocks.useSigningAccounts.mockReturnValue([])
        const { result, rerender } = render()

        expect(result.current.selected.size).toBe(0)

        mocks.useSigningAccounts.mockReturnValue([ACCOUNT_A, ACCOUNT_B])
        rerender()

        expect(result.current.selected.has('BBBB')).toBe(true)
    })

    it('pre-checks nothing for a page-initiated proposal', () => {
        mocks.useSelectedAccountId.mockReturnValue({
            selectedAccountId: 'account-b',
        })
        const { result } = render(
            proposalApproval({ requesterOrigin: 'https://dapp.example' }),
        )

        expect(result.current.selected.size).toBe(0)
        expect(result.current.canConnect).toBe(false)
    })

    it('cannot connect before the window is armed, even with an account picked', () => {
        mocks.useApprovalArming.mockReturnValue(false)
        mocks.useSelectedAccountId.mockReturnValue({
            selectedAccountId: 'account-b',
        })
        const { result } = render()

        expect(result.current.canConnect).toBe(false)
        act(() => result.current.handleConnect())
        expect(mocks.approve).not.toHaveBeenCalled()
    })

    it('pre-checks nothing when the active account cannot sign', () => {
        // A watch-only active account would otherwise arrive pre-selected and
        // fail on approve.
        mocks.useSelectedAccountId.mockReturnValue({
            selectedAccountId: 'account-z',
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

    it('surfaces the browser-verified requester origin untouched, with its host as the label', () => {
        const { result } = render(
            proposalApproval({ requesterOrigin: 'https://real-tab.example' }),
        )

        expect(result.current.requesterOrigin).toBe('https://real-tab.example')
        expect(result.current.requesterOriginLabel).toBe('real-tab.example')
    })

    it('cleans the peer-asserted name of bidi controls and clamps its length', () => {
        const { result } = render(
            proposalApproval({
                peer: { ...PEER, name: `Pera\u202E${'x'.repeat(200)}` },
            }),
        )

        expect(result.current.peerName).not.toContain('\u202E')
        expect(Array.from(result.current.peerName).length).toBeLessThanOrEqual(
            60,
        )
    })

    describe('requester origin vs the peer’s own url claim', () => {
        it('treats a matching origin as not distinct, so the header shows only the badge', () => {
            const { result } = render(
                proposalApproval({
                    origin: 'https://dapp.example',
                    requesterOrigin: 'https://dapp.example',
                }),
            )

            expect(result.current.isRequesterOriginDistinct).toBe(false)
        })

        it('ignores a path or trailing slash on the peer url when comparing', () => {
            // A peer url routinely carries a path while requesterOrigin is
            // always bare; a raw comparison would name the origin twice on
            // every ordinary connection.
            for (const peerUrl of [
                'https://dapp.example/',
                'https://dapp.example/connect?x=1',
                'https://dapp.example:443/deep/path#frag',
            ]) {
                const { result } = render(
                    proposalApproval({
                        origin: peerUrl,
                        requesterOrigin: 'https://dapp.example',
                    }),
                )
                expect(result.current.isRequesterOriginDistinct).toBe(false)
            }
        })

        it('reports a genuinely different origin as distinct, so the spoof stays visible', () => {
            // A page can pair while asserting someone else's url; the badge
            // must not silently vouch for it.
            const { result } = render(
                proposalApproval({
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
                    proposalApproval({
                        origin: peerUrl,
                        requesterOrigin: 'https://dapp.example',
                    }),
                )
                expect(result.current.isRequesterOriginDistinct).toBe(true)
            }
        })

        it('treats an unparseable peer url as distinct rather than vouching for it', () => {
            const { result } = render(
                proposalApproval({
                    origin: 'not a url',
                    requesterOrigin: 'https://real-tab.example',
                }),
            )

            expect(result.current.isRequesterOriginDistinct).toBe(true)
        })

        it('is never distinct when there is no requester origin to compare', () => {
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

    it('exposes no peer for an approval of another kind', () => {
        const { result } = render({
            kind: 'connection-error',
            requestId: 'x',
            origin: 'https://x.example',
        })

        expect(result.current.peer).toBe(null)
        expect(result.current.permissions).toEqual([])
    })

    describe('peer url link', () => {
        beforeEach(() => {
            vi.spyOn(Linking, 'openURL').mockResolvedValue(true)
        })

        it.each([
            'javascript:alert(document.cookie)',
            'data:text/html,<script>alert(1)</script>',
            'file:///etc/passwd',
            'http://dapp.example',
            '//evil.example',
        ])('does not open %j', url => {
            const { result } = render(
                proposalApproval({ peer: { ...PEER, url } }),
            )

            act(() => result.current.handlePressUrl())

            expect(Linking.openURL).not.toHaveBeenCalled()
            expect(result.current.canOpenPeerUrl).toBe(false)
        })

        it('opens an https peer url in a new tab', () => {
            const { result } = render()

            act(() => result.current.handlePressUrl())

            expect(Linking.openURL).toHaveBeenCalledWith('https://dapp.example')
        })

        it('labels the peer url without its scheme and marks it openable', () => {
            const { result } = render()

            expect(result.current.peerUrlLabel).toBe('dapp.example')
            expect(result.current.canOpenPeerUrl).toBe(true)
        })

        it('labels only the host, in punycode, so a homoglyph or a long path cannot pass for the real site', () => {
            const { result } = render(
                proposalApproval({
                    peer: { ...PEER, url: 'https://\u0430pple.com/login/x' },
                }),
            )

            expect(result.current.peerUrlLabel).toBe('xn--pple-43d.com')
        })
    })
})
