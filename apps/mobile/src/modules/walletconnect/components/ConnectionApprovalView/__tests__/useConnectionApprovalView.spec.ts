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

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { accountValueKey } from '@perawallet/wallet-core-accounts'
import { i18nKey } from '@perawallet/wallet-core-chain-contract'
import { WalletConnectEvent, AnalyticsMetadataKey } from '@analytics'
import { AppError } from '@perawallet/wallet-core-shared'
import { useSiteSafetyQuery } from '@perawallet/wallet-core-site-safety'
import {
    toOriginWarningMessage,
    useConnectionApprovalView,
} from '../useConnectionApprovalView'

const {
    trackEvent,
    confirmQuantumDappUsage,
    errorToast,
    showError,
    pushWebView,
    firstUnreachableChainsNote,
} = vi.hoisted(() => ({
    trackEvent: vi.fn(),
    confirmQuantumDappUsage: vi.fn(
        async (_accounts: string[]): Promise<'continue' | 'cancel'> =>
            'continue',
    ),
    errorToast: vi.fn(),
    showError: vi.fn(),
    pushWebView: vi.fn(),
    firstUnreachableChainsNote: vi.fn(),
}))

vi.mock('@analytics', async importOriginal => ({
    ...(await importOriginal<typeof import('@analytics')>()),
    trackEvent,
}))

vi.mock('@hooks/useQuantumDappWarning', () => ({
    useQuantumDappWarning: () => ({ confirmQuantumDappUsage }),
}))

vi.mock('@hooks/useToast', () => ({
    useToast: () => ({ errorToast }),
}))

vi.mock('@hooks/useErrorToast', () => ({
    useErrorToast: () => ({ showError }),
}))

vi.mock('@modules/webview/hooks/useWebViewStore', () => ({
    useWebView: () => ({ pushWebView }),
}))

// Keyed by address, one entry per chain an account is on, as the real query returns it.
const totals = vi.hoisted(() => ({
    current: new Map<string, { fiatValue: unknown; nativeValue: unknown }>(),
    query: vi.fn(),
    sort: vi.fn(),
}))

const ACCOUNTS = [
    { id: 'acct-algo', chains: { algorand: { address: 'AAAA' } } },
    {
        id: 'acct-both',
        chains: {
            algorand: { address: 'BBBB' },
            ethereum: { address: '0xBBBB' },
        },
    },
    { id: 'acct-eth-only', chains: { ethereum: { address: '0xCCCC' } } },
]

// The real `signingAddressesOn` resolves signers through chain adapters this
// spec has no reason to register; the hook's own job is the selection and the
// fan-out across `requested.chains`.
vi.mock('@perawallet/wallet-core-accounts', async importOriginal => ({
    ...(await importOriginal<
        typeof import('@perawallet/wallet-core-accounts')
    >()),
    useAllAccounts: () => ACCOUNTS,
    useSigningAccountsOn: () => ACCOUNTS,
    firstUnreachableChainsNote,
    useAccountValueTotalsQuery: (...args: unknown[]) => {
        totals.query(...args)
        return { accountValueTotals: totals.current }
    },
    useSortedAccounts: (...args: unknown[]) => totals.sort(...args),
    signingAddressesOn: (
        account: (typeof ACCOUNTS)[number],
        _accounts: unknown,
        chainIds: readonly string[],
    ) =>
        chainIds.flatMap(
            chainId =>
                (account.chains as Record<string, { address: string }>)[chainId]
                    ?.address ?? [],
        ),
}))

const makeProposal = (overrides = {}) => ({
    kind: 'walletconnect-v1',
    proposalId: 'p1',
    peer: { name: 'Tinyman', url: 'https://tinyman.org' },
    requested: {
        networks: ['mainnet'],
        chains: ['algorand'],
        methods: ['algo_signTxn'],
    },
    expiresAt: Date.now() + 60_000,
    approve: vi.fn(async () => ({ id: 'c1' })),
    reject: vi.fn(async () => {}),
    ...overrides,
})

describe('useConnectionApprovalView', () => {
    beforeEach(() => {
        confirmQuantumDappUsage.mockReset().mockResolvedValue('continue')
        firstUnreachableChainsNote.mockReset().mockReturnValue(null)
    })

    it("words the empty-list note from a held account's kind that can't reach the requested chains", () => {
        totals.sort.mockImplementation(() => ({ sortedAccounts: [] }))
        firstUnreachableChainsNote.mockReturnValue('kind.unreachable_note')
        const proposal = makeProposal()

        const { result } = renderHook(() =>
            useConnectionApprovalView(proposal as never),
        )

        expect(result.current.noAccountsNote).toBe('kind.unreachable_note')
        expect(firstUnreachableChainsNote).toHaveBeenCalledWith(ACCOUNTS, [
            'algorand',
        ])
    })

    it('falls back to the generic empty-list note when no kind says why', () => {
        totals.sort.mockImplementation(() => ({ sortedAccounts: [] }))
        const { result } = renderHook(() =>
            useConnectionApprovalView(makeProposal() as never),
        )

        expect(result.current.noAccountsNote).toBe(
            'walletconnect.request.no_accounts',
        )
    })

    afterEach(() => {
        trackEvent.mockClear()
        errorToast.mockClear()
        showError.mockClear()
        pushWebView.mockClear()
    })

    // The ranking itself is the accounts package's; what this hook owns is
    // feeding it every chain's totals, so an Ethereum account ranks by its
    // own balance instead of as if empty.
    describe('sortedAccounts', () => {
        beforeEach(() => {
            totals.query.mockClear()
            totals.sort.mockReset()
            totals.sort.mockImplementation((accounts: unknown[]) => ({
                sortedAccounts: [...accounts].reverse(),
            }))
        })

        it('is the signing accounts in the order the shared sort gives them', () => {
            const { result } = renderHook(() =>
                useConnectionApprovalView(makeProposal() as never),
            )

            expect(result.current.sortedAccounts.map(({ id }) => id)).toEqual([
                'acct-eth-only',
                'acct-both',
                'acct-algo',
            ])
        })

        it('sorts by the value totals of every chain, keyed by chain and address', () => {
            const accountValueTotals = new Map([
                [
                    accountValueKey('ethereum', '0xCCCC'),
                    { fiatValue: 50, nativeValue: 50 },
                ],
            ])
            totals.current = accountValueTotals as never

            renderHook(() => useConnectionApprovalView(makeProposal() as never))

            expect(totals.query).toHaveBeenCalledWith(
                ACCOUNTS,
                expect.objectContaining({ chainId: 'algorand' }),
                true,
            )
            expect(totals.sort).toHaveBeenCalledWith(
                ACCOUNTS,
                accountValueTotals,
                'algorand',
            )
        })
    })

    it('approves through the proposal, with no registry lookup', async () => {
        const proposal = makeProposal()
        const { result } = renderHook(() =>
            useConnectionApprovalView(proposal as never),
        )

        act(() => result.current.handleAccountPress('acct-algo'))
        await act(() => result.current.handleConnect())

        expect(proposal.approve).toHaveBeenCalledWith(['AAAA'])
    })

    describe('site safety', () => {
        afterEach(() => {
            vi.mocked(useSiteSafetyQuery).mockReturnValue({
                verdict: { kind: 'clear' },
                isChecking: false,
            })
        })

        it("checks every origin the proposal carries, with Verify's verdict", () => {
            renderHook(() =>
                useConnectionApprovalView(
                    makeProposal({
                        requesterOrigin: 'https://observed.example',
                        peer: {
                            name: 'Tinyman',
                            url: 'https://tinyman.org',
                            verification: {
                                status: 'scam',
                                verifiedOrigin: 'https://attested.example',
                            },
                        },
                    }) as never,
                ),
            )

            expect(useSiteSafetyQuery).toHaveBeenLastCalledWith({
                urls: [
                    'https://tinyman.org',
                    'https://observed.example',
                    'https://attested.example',
                ],
                isFlaggedByWalletConnectVerify: true,
                isEnabled: true,
            })
        })

        it('refuses to approve a blocked site', async () => {
            vi.mocked(useSiteSafetyQuery).mockReturnValue({
                verdict: {
                    kind: 'blocked',
                    host: 'tinyman.org',
                    reason: 'phishing-list',
                },
                isChecking: false,
            })
            const proposal = makeProposal()
            const { result } = renderHook(() =>
                useConnectionApprovalView(proposal as never),
            )

            act(() => result.current.handleAccountPress('acct-algo'))
            await act(() => result.current.handleConnect())

            expect(result.current.siteSafety.isApprovalAllowed).toBe(false)
            expect(proposal.approve).not.toHaveBeenCalled()
        })
    })

    it('rejects through the proposal on cancel', async () => {
        const proposal = makeProposal()
        const { result } = renderHook(() =>
            useConnectionApprovalView(proposal as never),
        )

        await act(() => result.current.handleCancel())

        expect(proposal.reject).toHaveBeenCalled()
    })

    it('approves every selected account on each requested chain it has an entry on', async () => {
        const proposal = makeProposal({
            requested: {
                networks: ['mainnet'],
                chains: ['algorand', 'ethereum'],
                methods: [],
            },
        })
        const { result } = renderHook(() =>
            useConnectionApprovalView(proposal as never),
        )

        act(() => result.current.handleAccountPress('acct-both'))
        act(() => result.current.handleAccountPress('acct-algo'))
        await act(() => result.current.handleConnect())

        expect(proposal.approve).toHaveBeenCalledWith([
            'BBBB',
            '0xBBBB',
            'AAAA',
        ])
        expect(confirmQuantumDappUsage).toHaveBeenCalledWith([
            'BBBB',
            '0xBBBB',
            'AAAA',
        ])
    })

    it('gives an account no address on a chain the proposal did not request', async () => {
        const proposal = makeProposal()
        const { result } = renderHook(() =>
            useConnectionApprovalView(proposal as never),
        )

        act(() => result.current.handleAccountPress('acct-both'))
        await act(() => result.current.handleConnect())

        expect(proposal.approve).toHaveBeenCalledWith(['BBBB'])
    })

    it('counts selected accounts, not addresses, in the approval event', async () => {
        const proposal = makeProposal({
            requested: {
                networks: ['mainnet'],
                chains: ['algorand', 'ethereum'],
                methods: [],
            },
        })
        const { result } = renderHook(() =>
            useConnectionApprovalView(proposal as never),
        )

        act(() => result.current.handleAccountPress('acct-both'))
        await act(() => result.current.handleConnect())

        expect(trackEvent).toHaveBeenCalledWith(
            WalletConnectEvent.SessionApproved,
            expect.objectContaining({
                [AnalyticsMetadataKey.TotalAccount]: 1,
            }),
        )
    })

    it('toggles account selection', () => {
        const { result } = renderHook(() =>
            useConnectionApprovalView(makeProposal() as never),
        )

        act(() => result.current.handleAccountPress('acct-algo'))
        act(() => result.current.handleAccountPress('acct-algo'))

        expect(result.current.selectedAccounts).toEqual([])
    })

    // The handler owns the expiry verdict and throws a typed error; a second
    // check here only lets the two answers drift.
    it('surfaces the expired error the handler throws, and settles the proposal', async () => {
        const expired = new AppError('This connection request has expired', {
            messageKey: i18nKey(
                'errors.walletconnect.session_request_expired_body',
            ),
            retryable: false,
        })
        const proposal = makeProposal({
            approve: vi.fn(async () => {
                throw expired
            }),
        })
        const { result } = renderHook(() =>
            useConnectionApprovalView(proposal as never),
        )

        act(() => result.current.handleAccountPress('acct-algo'))
        await act(() => result.current.handleConnect())

        // main toasted this; the local pre-check that replaced it closed the
        // sheet silently.
        expect(showError).toHaveBeenCalledWith(expired, expect.any(String))
        // Retrying an expired handshake can only fake-succeed.
        expect(proposal.reject).toHaveBeenCalled()
    })

    it('keeps the sheet open for a retryable delivery failure', async () => {
        const timeout = new AppError("Couldn't reach WalletConnect", {
            messageKey: i18nKey('errors.walletconnect.connection_timeout_body'),
            retryable: true,
        })
        const proposal = makeProposal({
            approve: vi.fn(async () => {
                throw timeout
            }),
        })
        const { result } = renderHook(() =>
            useConnectionApprovalView(proposal as never),
        )

        act(() => result.current.handleAccountPress('acct-algo'))
        await act(() => result.current.handleConnect())

        expect(errorToast).toHaveBeenCalled()
        expect(proposal.reject).not.toHaveBeenCalled()
    })

    it('gates approval behind the quantum-dApp warning, before approve runs', async () => {
        const proposal = makeProposal()
        const { result } = renderHook(() =>
            useConnectionApprovalView(proposal as never),
        )

        act(() => result.current.handleAccountPress('acct-algo'))
        await act(() => result.current.handleConnect())

        expect(confirmQuantumDappUsage).toHaveBeenCalledWith(['AAAA'])
        expect(proposal.approve).toHaveBeenCalled()
    })

    it('rejects instead of approving when the quantum warning is cancelled', async () => {
        confirmQuantumDappUsage.mockResolvedValue('cancel')
        const proposal = makeProposal()
        const { result } = renderHook(() =>
            useConnectionApprovalView(proposal as never),
        )

        act(() => result.current.handleAccountPress('acct-algo'))
        await act(() => result.current.handleConnect())

        expect(proposal.approve).not.toHaveBeenCalled()
        expect(proposal.reject).toHaveBeenCalled()
    })

    it('tracks a SessionApproved event on approval', async () => {
        const proposal = makeProposal()
        const { result } = renderHook(() =>
            useConnectionApprovalView(proposal as never),
        )

        act(() => result.current.handleAccountPress('acct-algo'))
        await act(() => result.current.handleConnect())

        expect(trackEvent).toHaveBeenCalledWith(
            WalletConnectEvent.SessionApproved,
            expect.objectContaining({
                [AnalyticsMetadataKey.DappName]: 'Tinyman',
                [AnalyticsMetadataKey.DappUrl]: 'https://tinyman.org',
                [AnalyticsMetadataKey.AccountAddress]: 'AAAA',
                [AnalyticsMetadataKey.TotalAccount]: 1,
                [AnalyticsMetadataKey.ChainId]: 'algorand',
            }),
        )
    })

    it('tracks SessionApproved once per distinct requested chain', async () => {
        const proposal = makeProposal({
            requested: {
                networks: ['mainnet'],
                chains: ['algorand', 'ethereum'],
                methods: [],
            },
        })
        const { result } = renderHook(() =>
            useConnectionApprovalView(proposal as never),
        )

        act(() => result.current.handleAccountPress('acct-both'))
        await act(() => result.current.handleConnect())

        const approved = trackEvent.mock.calls
            .filter(([event]) => event === WalletConnectEvent.SessionApproved)
            .map(([, props]) => [
                props?.[AnalyticsMetadataKey.ChainId],
                props?.[AnalyticsMetadataKey.AccountAddress],
            ])
        expect(approved).toEqual([
            ['algorand', 'BBBB'],
            ['ethereum', '0xBBBB'],
        ])
    })

    it('tracks SessionApproved only for the requested chains a selected account holds', async () => {
        const proposal = makeProposal({
            requested: {
                networks: ['mainnet'],
                chains: ['algorand', 'ethereum'],
                methods: [],
            },
        })
        const { result } = renderHook(() =>
            useConnectionApprovalView(proposal as never),
        )

        act(() => result.current.handleAccountPress('acct-algo'))
        await act(() => result.current.handleConnect())

        const approvedChains = trackEvent.mock.calls
            .filter(([event]) => event === WalletConnectEvent.SessionApproved)
            .map(([, props]) => props?.[AnalyticsMetadataKey.ChainId])
        expect(approvedChains).toEqual(['algorand'])
    })

    it('still tracks SessionApproved and SessionRejected once when the proposal names no chain', async () => {
        const proposal = makeProposal({
            requested: { networks: ['mainnet'], chains: [], methods: [] },
        })
        const { result } = renderHook(() =>
            useConnectionApprovalView(proposal as never),
        )

        act(() => result.current.handleAccountPress('acct-algo'))
        await act(() => result.current.handleConnect())
        await act(() => result.current.handleCancel())

        const chainsOf = (event: string) =>
            trackEvent.mock.calls
                .filter(([name]) => name === event)
                .map(([, props]) => props?.[AnalyticsMetadataKey.ChainId])
        expect(chainsOf(WalletConnectEvent.SessionApproved)).toEqual([
            'algorand',
        ])
        expect(chainsOf(WalletConnectEvent.SessionRejected)).toEqual([
            'algorand',
        ])
    })

    it('tracks SessionApproved once for a chain requested on two networks', async () => {
        const proposal = makeProposal({
            requested: {
                networks: ['mainnet', 'testnet'],
                chains: ['algorand', 'algorand'],
                methods: [],
            },
        })
        const { result } = renderHook(() =>
            useConnectionApprovalView(proposal as never),
        )

        act(() => result.current.handleAccountPress('acct-algo'))
        await act(() => result.current.handleConnect())

        const approvedCalls = trackEvent.mock.calls.filter(
            ([event]) => event === WalletConnectEvent.SessionApproved,
        )
        expect(approvedCalls).toHaveLength(1)
        expect(approvedCalls[0][1]).toEqual(
            expect.objectContaining({
                [AnalyticsMetadataKey.ChainId]: 'algorand',
            }),
        )
    })

    it('tracks a SessionRejected event on cancel', async () => {
        const proposal = makeProposal()
        const { result } = renderHook(() =>
            useConnectionApprovalView(proposal as never),
        )

        await act(() => result.current.handleCancel())

        expect(trackEvent).toHaveBeenCalledWith(
            WalletConnectEvent.SessionRejected,
            expect.objectContaining({
                [AnalyticsMetadataKey.DappName]: 'Tinyman',
                [AnalyticsMetadataKey.DappUrl]: 'https://tinyman.org',
                [AnalyticsMetadataKey.ChainId]: 'algorand',
            }),
        )
    })

    it('shows a retry toast and keeps the proposal unsettled when approve delivery fails', async () => {
        const proposal = makeProposal({
            approve: vi.fn(async () => {
                throw new Error('delivery failed')
            }),
        })
        const { result } = renderHook(() =>
            useConnectionApprovalView(proposal as never),
        )

        act(() => result.current.handleAccountPress('acct-algo'))
        await act(() => result.current.handleConnect())

        expect(errorToast).toHaveBeenCalled()
        // Delivery failure is retryable: the screen must not have rejected
        // the proposal out from under the user, and the button must be
        // tappable again.
        expect(proposal.reject).not.toHaveBeenCalled()
        expect(result.current.isConnecting).toBe(false)
    })

    it('ignores a second Cancel tap while the first reject is still in flight', async () => {
        const proposal = makeProposal()
        let resolveReject: () => void = () => {}
        proposal.reject = vi.fn(
            () =>
                new Promise<void>(resolve => {
                    resolveReject = resolve
                }),
        )
        const { result } = renderHook(() =>
            useConnectionApprovalView(proposal as never),
        )

        let firstCall!: Promise<void>
        let secondCall!: Promise<void>
        act(() => {
            firstCall = result.current.handleCancel()
            secondCall = result.current.handleCancel()
        })
        resolveReject()
        await act(async () => {
            await Promise.all([firstCall, secondCall])
        })

        // A double-tapped Cancel (nothing disables the button while a
        // reject is in flight) must reach `proposal.reject` once, not
        // twice — a second call here is exactly what fed
        // `useConnectionsProvider`'s stale-settle bug.
        expect(proposal.reject).toHaveBeenCalledTimes(1)
    })

    it('ignores a second Connect tap while the quantum warning is still pending', async () => {
        let resolveDecision: (
            decision: 'continue' | 'cancel',
        ) => void = () => {}
        confirmQuantumDappUsage.mockImplementation(
            () =>
                new Promise(resolve => {
                    resolveDecision = resolve
                }),
        )
        const proposal = makeProposal()
        const { result } = renderHook(() =>
            useConnectionApprovalView(proposal as never),
        )
        act(() => result.current.handleAccountPress('acct-algo'))

        let firstCall!: Promise<void>
        let secondCall!: Promise<void>
        act(() => {
            firstCall = result.current.handleConnect()
            secondCall = result.current.handleConnect()
        })
        resolveDecision('continue')
        await act(async () => {
            await Promise.all([firstCall, secondCall])
        })

        // `isConnecting` doesn't flip true until AFTER the quantum-warning
        // await resolves, so `isLoading`/`isDisabled` alone can't stop a
        // second tap landing during that gap — this is what closes it.
        expect(confirmQuantumDappUsage).toHaveBeenCalledTimes(1)
        expect(proposal.approve).toHaveBeenCalledTimes(1)
    })

    it.each([
        'javascript:alert(document.cookie)',
        'data:text/html,<script>alert(1)</script>',
        'file:///etc/passwd',
        'intent://evil.example#Intent;scheme=https;end',
        'content://com.evil.provider/secret',
        'http://insecure.example',
        '//evil.example',
        '',
    ])('does not open the WebView for the peer url %j', url => {
        const { result } = renderHook(() =>
            useConnectionApprovalView(
                makeProposal({ peer: { name: 'Tinyman', url } }) as never,
            ),
        )

        act(() => result.current.handlePressUrl())

        expect(pushWebView).not.toHaveBeenCalled()
        expect(result.current.canOpenPeerUrl).toBe(false)
    })

    it.each([
        ['https://tinyman.org/pools', 'https://tinyman.org/pools'],
        ['tinyman.org', 'https://tinyman.org'],
    ])('opens the WebView for the peer url %j at %j', (url, expected) => {
        const { result } = renderHook(() =>
            useConnectionApprovalView(
                makeProposal({ peer: { name: 'Tinyman', url } }) as never,
            ),
        )

        act(() => result.current.handlePressUrl())

        expect(pushWebView).toHaveBeenCalledWith({
            id: expect.any(String),
            url: expected,
        })
    })

    it('labels the peer url by its host alone and marks it openable', () => {
        const { result } = renderHook(() =>
            useConnectionApprovalView(
                makeProposal({
                    peer: { name: 'Tinyman', url: 'https://tinyman.org/pools' },
                }) as never,
            ),
        )

        expect(result.current.peerUrlLabel).toBe('tinyman.org')
        expect(result.current.canOpenPeerUrl).toBe(true)
    })

    it('cleans the peer-asserted name of bidi controls before it is shown', () => {
        const { result } = renderHook(() =>
            useConnectionApprovalView(
                makeProposal({
                    peer: {
                        name: 'Tiny\u202Enamyt\u202C',
                        url: 'https://tinyman.org',
                    },
                }) as never,
            ),
        )

        expect(result.current.peerName).toBe('Tinynamyt')
    })

    describe('origin verification', () => {
        const renderWithVerification = (peer: Record<string, unknown>) =>
            renderHook(() =>
                useConnectionApprovalView(makeProposal({ peer }) as never),
            ).result.current

        it('warns about nothing when the transport attested no origin', () => {
            const result = renderWithVerification({
                name: 'Tinyman',
                url: 'https://tinyman.org',
            })

            expect(result.originWarning).toBeUndefined()
            expect(result.verifiedOriginLabel).toBeUndefined()
        })

        it('warns about nothing for an attested matching origin', () => {
            const result = renderWithVerification({
                name: 'Tinyman',
                url: 'https://tinyman.org',
                verification: {
                    status: 'valid',
                    verifiedOrigin: 'https://tinyman.org',
                },
            })

            expect(result.originWarning).toBeUndefined()
        })

        it('flags a mismatch and labels the attested origin by its host', () => {
            const result = renderWithVerification({
                name: 'Tinyman',
                url: 'https://tinyman.org',
                verification: {
                    status: 'mismatch',
                    verifiedOrigin: 'https://evil.example',
                },
            })

            expect(result.originWarning).toBe('mismatch')
            expect(result.verifiedOriginLabel).toBe('evil.example')
        })

        it('labels the attested origin of a mismatch whose peer claims no url', () => {
            const result = renderWithVerification({
                name: 'Tinyman',
                verification: {
                    status: 'mismatch',
                    verifiedOrigin: 'https://evil.example',
                },
            })

            expect(result.originWarning).toBe('mismatch')
            expect(result.verifiedOriginLabel).toBe('evil.example')
            expect(result.peerUrlLabel).toBeUndefined()
        })

        it('flags a scam verdict as scam', () => {
            const result = renderWithVerification({
                name: 'Tinyman',
                url: 'https://tinyman.org',
                verification: {
                    status: 'scam',
                    verifiedOrigin: 'https://evil.example',
                },
            })

            expect(result.originWarning).toBe('scam')
        })

        it('marks an origin nothing could attest as unverified', () => {
            const result = renderWithVerification({
                name: 'Tinyman',
                url: 'https://tinyman.org',
                verification: { status: 'unknown' },
            })

            expect(result.originWarning).toBe('unverified')
            expect(result.verifiedOriginLabel).toBeUndefined()
        })
    })
})

describe('toOriginWarningMessage', () => {
    it('names the attested origin first and the claimed one second', () => {
        expect(
            toOriginWarningMessage('mismatch', 'evil.example', 'tinyman.org'),
        ).toEqual({
            key: 'dapp.approval.requester_mismatch',
            params: { origin: 'evil.example', claimed: 'tinyman.org' },
        })
    })

    it('names only the attested origin when the peer claims no url', () => {
        expect(
            toOriginWarningMessage('mismatch', 'evil.example', undefined),
        ).toEqual({
            key: 'dapp.approval.request_origin',
            params: { origin: 'evil.example' },
        })
    })

    it('names the origin once when it differs from the claim only by scheme', () => {
        expect(
            toOriginWarningMessage('mismatch', 'dapp.example', 'dapp.example'),
        ).toEqual({
            key: 'dapp.approval.request_origin',
            params: { origin: 'dapp.example' },
        })
    })

    it('says the site is unverified when no origin was attested', () => {
        expect(
            toOriginWarningMessage('mismatch', undefined, 'tinyman.org'),
        ).toEqual({ key: 'walletconnect.request.origin_unverified' })
    })

    it('uses the security-risk copy for a scam verdict', () => {
        expect(
            toOriginWarningMessage('scam', 'evil.example', 'tinyman.org'),
        ).toEqual({ key: 'walletconnect.request.origin_scam' })
    })
})
