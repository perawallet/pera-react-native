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

import { Decimal } from 'decimal.js'
import { act, renderHook } from '@test-utils/render'
import {
    afterEach,
    beforeEach,
    describe,
    expect,
    it,
    vi,
    type Mock,
} from 'vitest'
import { useSendFunds } from '@modules/transactions/hooks'
import {
    canSignWith,
    useAccountBalancesQuery,
    useAllAccounts,
    useOnChainAccountStateQuery,
} from '@perawallet/wallet-core-accounts'
import { useAssetsQuery } from '@perawallet/wallet-core-assets'
import { useSelectDestinationScreen } from '../useSelectDestinationScreen'
import { addressCodecs } from '@perawallet/wallet-core-chain-contract'
import { fixtureCodec } from '@packages/chain-contract/src/__tests__/testing'

const mockNavigate = vi.fn()
const mockStackRoutes = vi.fn<() => { key: string }[]>()
const ROUTE_KEY = 'select-destination'
const mockOnFinished = vi.fn()
const mockSetSendMode = vi.fn()
const mockSetDestination = vi.fn()
const mockErrorToast = vi.fn()

const {
    mockCanSignWith,
    mockUseAllAccounts,
    mockGetArc59Config,
    mockSendScope,
    mockSelectedAccount,
    mockChainName,
} = vi.hoisted(() => ({
    mockCanSignWith: vi.fn(),
    mockUseAllAccounts: vi.fn(),
    mockGetArc59Config: vi.fn(),
    mockSendScope: { value: { chainId: 'algorand', networkId: 'testnet' } },
    mockSelectedAccount: {
        value: {
            id: 'sender',
            custody: { kind: 'watch' },
            chains: { algorand: { address: 'SENDERADDR' } } as Record<
                string,
                { address: string }
            >,
        },
    },
    mockChainName: { value: undefined as string | undefined },
}))

vi.mock('@hooks/useChainNameWhenMultiChain', () => ({
    useChainNameWhenMultiChain: () => mockChainName.value,
}))

const mockVerifyNameAddress = vi.hoisted(() => vi.fn())
vi.mock('@perawallet/wallet-core-nfd', () => ({
    verifyNameAddress: mockVerifyNameAddress,
}))

vi.mock('@react-navigation/native', () => ({
    useNavigation: () => ({
        navigate: mockNavigate,
    }),
    useRoute: () => ({ key: ROUTE_KEY }),
    useNavigationState: (
        selector: (state: { routes: { key: string }[] }) => unknown,
    ) => selector({ routes: mockStackRoutes() }),
}))

vi.mock('@perawallet/wallet-core-chain-shared', () => ({
    getChainDescriptor: () => ({ displayName: 'Algorand' }),
    useSelectedScope: (chainId: string) => ({ chainId, networkId: 'testnet' }),
}))

vi.mock('@perawallet/wallet-core-config', () => ({
    getArc59Config: mockGetArc59Config,
}))

// Algorand routes opt-in sends through its send-flow adapter.
vi.mock('@perawallet/wallet-core-transactions', () => ({
    sendFlowChainAdapters: { has: () => true },
}))

vi.mock('@hooks/useCapability', async () =>
    (await import('@test-utils/capability-mock')).capabilityHookMock(),
)

vi.mock('../../useRecipientPoisoningGate', () => ({
    useRecipientPoisoningGate: () => ({
        screenRecipient: () => Promise.resolve(true),
        isScreeningRecipient: false,
    }),
}))

vi.mock('@hooks/useToast', () => ({
    useToast: () => ({ errorToast: mockErrorToast }),
}))

vi.mock('@hooks/useLanguage')

vi.mock('@modules/transactions/hooks', () => ({
    useSendFunds: vi.fn(),
    useSendScope: () => mockSendScope.value,
}))

vi.mock('@perawallet/wallet-core-accounts', () => ({
    canSignWith: mockCanSignWith,
    useAccountBalancesQuery: vi.fn(),
    useAllAccounts: mockUseAllAccounts,
    useOnChainAccountStateQuery: vi.fn(),
    useSelectedAccount: () => mockSelectedAccount.value,
    addressOn: (
        account: { chains: Record<string, { address: string }> },
        scope: { chainId: string },
    ) => account.chains[scope.chainId]?.address,
    findAccountByAddressOn: (
        accounts: { chains: Record<string, { address: string }> }[],
        chainId: string,
        address: string,
    ) => accounts.find(a => a.chains[chainId]?.address === address),
}))

vi.mock('@perawallet/wallet-core-assets', () => ({
    useIsNativeAssetId: () => (id: unknown) => id != null && String(id) === '0',
    isNativeAssetId: (_chainId: string, id: string) => id === '0',
    useAssetsQuery: vi.fn(() => ({
        data: new Map([['123', { assetId: '123', name: 'TestToken' }]]),
    })),
}))

const ASA_ID = '123'
const EXTERNAL_ADDR = 'EXTERNALADDR'
const INTERNAL_SIGNABLE_ADDR = 'SIGNABLEADDR'
const INTERNAL_WATCH_ADDR = 'WATCHADDR'
const INTERNAL_OPTED_IN_ADDR = 'OPTEDINADDR'

// Every receiver these tests route is a valid address on the send chain.
beforeEach(() => {
    addressCodecs.register({
        ...fixtureCodec,
        chainId: 'algorand',
        isValid: () => true,
    })
})

afterEach(() => {
    addressCodecs.reset()
})

describe('useSelectDestinationScreen', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockSendScope.value = { chainId: 'algorand', networkId: 'testnet' }
        mockSelectedAccount.value = {
            id: 'sender',
            custody: { kind: 'watch' },
            chains: { algorand: { address: 'SENDERADDR' } },
        }
        mockChainName.value = undefined

        // Default to a pushed screen so the default header back button applies;
        // the close-control tests flip this to model the pure-NFT flow root.
        mockStackRoutes.mockReturnValue([
            { key: 'input-amount' },
            { key: ROUTE_KEY },
        ])
        mockUseAllAccounts.mockReturnValue([])
        mockCanSignWith.mockReturnValue(false)

        // clearAllMocks wipes call history but keeps implementations, so a
        // per-test mockReturnValue on useAssetsQuery would leak. Re-seed the
        // default (ASA_ID resolvable, query settled) every run.
        ;(useAssetsQuery as Mock).mockReturnValue({
            data: new Map([[ASA_ID, { assetId: ASA_ID, name: 'TestToken' }]]),
            isFetched: true,
        })

        ;(useSendFunds as Mock).mockReturnValue({
            selectedAssetId: ASA_ID,
            onFinished: mockOnFinished,
            setDestination: mockSetDestination,
            setSendMode: mockSetSendMode,
        })

        ;(useAccountBalancesQuery as Mock).mockReturnValue({
            accountBalances: new Map(),
            isPending: false,
        })

        ;(useAllAccounts as Mock).mockReturnValue([])
        ;(canSignWith as Mock).mockReturnValue(false)
        ;(useOnChainAccountStateQuery as Mock).mockReturnValue({
            data: undefined,
            isFetching: false,
            isSuccess: false,
            isError: false,
        })

        mockGetArc59Config.mockReturnValue({
            appId: 643_020_148n,
            appAddress: 'APP_ADDRESS',
        })
    })

    it('navigates to ConfirmTransaction for ALGO sends', async () => {
        ;(useSendFunds as Mock).mockReturnValue({
            selectedAssetId: '0',
            setDestination: mockSetDestination,
            setSendMode: mockSetSendMode,
        })

        const { result } = renderHook(() => useSelectDestinationScreen())

        await act(async () => {
            result.current.handleSelected(EXTERNAL_ADDR)
        })

        expect(mockSetSendMode).toHaveBeenCalledWith('normal')
        expect(mockNavigate).toHaveBeenCalledWith('ConfirmTransaction')
    })

    it('navigates to ConfirmTransaction for internal account already opted in', async () => {
        ;(useAccountBalancesQuery as Mock).mockReturnValue({
            accountBalances: new Map([
                [
                    INTERNAL_OPTED_IN_ADDR,
                    { assetBalances: [{ assetId: ASA_ID }] },
                ],
            ]),
        })

        const { result } = renderHook(() => useSelectDestinationScreen())

        await act(async () => {
            result.current.handleSelected(INTERNAL_OPTED_IN_ADDR)
        })

        expect(mockSetSendMode).toHaveBeenCalledWith('normal')
        expect(mockNavigate).toHaveBeenCalledWith('ConfirmTransaction')
    })

    it('navigates to ExpressSend for internal signable account not opted in', async () => {
        mockUseAllAccounts.mockReturnValue([
            {
                chains: { algorand: { address: INTERNAL_SIGNABLE_ADDR } },
                name: 'Signable',
            },
        ])
        mockCanSignWith.mockReturnValue(true)

        const { result } = renderHook(() => useSelectDestinationScreen())

        await act(async () => {
            result.current.handleSelected(INTERNAL_SIGNABLE_ADDR)
        })

        expect(mockSetSendMode).toHaveBeenCalledWith('express')
        expect(mockNavigate).toHaveBeenCalledWith('ExpressSend')
    })

    it('navigates to AssetInboxSendSummary for internal watch account not opted in', async () => {
        mockUseAllAccounts.mockReturnValue([
            {
                chains: { algorand: { address: INTERNAL_WATCH_ADDR } },
                name: 'Watch',
            },
        ])
        mockCanSignWith.mockReturnValue(false)

        const { result } = renderHook(() => useSelectDestinationScreen())

        await act(async () => {
            result.current.handleSelected(INTERNAL_WATCH_ADDR)
        })

        expect(mockSetSendMode).toHaveBeenCalledWith('sendAssetInbox')
        expect(mockNavigate).toHaveBeenCalledWith('AssetInboxSendSummary')
    })

    it('navigates to ConfirmTransaction for external account already opted in on-chain', async () => {
        ;(useOnChainAccountStateQuery as Mock).mockReturnValue({
            data: {
                holdings: [
                    {
                        assetId: ASA_ID,
                        amount: new Decimal(100),
                    },
                ],
            },
            isFetching: false,
            isSuccess: true,
            isError: false,
        })

        const { result } = renderHook(() => useSelectDestinationScreen())

        await act(async () => {
            result.current.handleSelected(EXTERNAL_ADDR)
        })

        expect(mockSetSendMode).toHaveBeenCalledWith('normal')
        expect(mockNavigate).toHaveBeenCalledWith('ConfirmTransaction')
    })

    it('navigates to AssetInboxSendSummary for external account not opted in on-chain', async () => {
        ;(useOnChainAccountStateQuery as Mock).mockReturnValue({
            data: { holdings: [] },
            isFetching: false,
            isSuccess: true,
            isError: false,
        })

        const { result } = renderHook(() => useSelectDestinationScreen())

        await act(async () => {
            result.current.handleSelected(EXTERNAL_ADDR)
        })

        expect(mockSetSendMode).toHaveBeenCalledWith('sendAssetInbox')
        expect(mockNavigate).toHaveBeenCalledWith('AssetInboxSendSummary')
    })

    it('falls back to AssetInboxSendSummary when on-chain query fails for external account', async () => {
        ;(useOnChainAccountStateQuery as Mock).mockReturnValue({
            data: undefined,
            isFetching: false,
            isSuccess: false,
            isError: true,
        })

        const { result } = renderHook(() => useSelectDestinationScreen())

        await act(async () => {
            result.current.handleSelected(EXTERNAL_ADDR)
        })

        expect(mockSetSendMode).toHaveBeenCalledWith('sendAssetInbox')
        expect(mockNavigate).toHaveBeenCalledWith('AssetInboxSendSummary')
    })

    // ARC-59 needs the router contract + Pera backend; on networks without
    // them (getArc59Config → null) the route is blocked with a toast instead
    // of landing on a summary screen that can never load.
    describe('inbox unavailable on network', () => {
        it('blocks the inbox route with a toast for a local unsignable receiver', async () => {
            mockGetArc59Config.mockReturnValue(null)
            mockUseAllAccounts.mockReturnValue([
                {
                    chains: { algorand: { address: INTERNAL_WATCH_ADDR } },
                    name: 'Watch',
                },
            ])
            mockCanSignWith.mockReturnValue(false)

            const { result } = renderHook(() => useSelectDestinationScreen())

            await act(async () => {
                result.current.handleSelected(INTERNAL_WATCH_ADDR)
            })

            expect(mockSetSendMode).not.toHaveBeenCalledWith('sendAssetInbox')
            expect(mockNavigate).not.toHaveBeenCalled()
            expect(mockErrorToast).toHaveBeenCalledWith(
                'send_funds.destination.inbox_unavailable_title',
                'send_funds.destination.inbox_unavailable_body',
            )
        })

        it('blocks the inbox route with a toast for an external receiver not opted in', async () => {
            mockGetArc59Config.mockReturnValue(null)
            ;(useOnChainAccountStateQuery as Mock).mockReturnValue({
                data: { holdings: [] },
                isFetching: false,
                isSuccess: true,
                isError: false,
            })

            const { result } = renderHook(() => useSelectDestinationScreen())

            await act(async () => {
                result.current.handleSelected(EXTERNAL_ADDR)
            })

            expect(mockSetSendMode).not.toHaveBeenCalledWith('sendAssetInbox')
            expect(mockNavigate).not.toHaveBeenCalled()
            expect(mockErrorToast).toHaveBeenCalledWith(
                'send_funds.destination.inbox_unavailable_title',
                'send_funds.destination.inbox_unavailable_body',
            )
        })
    })

    // A value-bearing deeplink (algorand://<address>?amount=…) prefills the
    // destination before this screen mounts. The receiver is already known, so
    // the picker must be bypassed and the flow routed straight through.
    describe('prefilled deeplink destination', () => {
        it('auto-uses the prefilled destination and skips the picker (ALGO)', async () => {
            ;(useAssetsQuery as Mock).mockReturnValue({
                data: new Map([['0', { assetId: '0', name: 'Algo' }]]),
            })
            ;(useSendFunds as Mock).mockReturnValue({
                selectedAssetId: '0',
                destination: EXTERNAL_ADDR,
                setDestination: mockSetDestination,
                setSendMode: mockSetSendMode,
            })

            const { result } = renderHook(() => useSelectDestinationScreen())
            await act(async () => {})

            expect(mockSetDestination).toHaveBeenCalledWith(EXTERNAL_ADDR)
            expect(mockNavigate).toHaveBeenCalledWith('ConfirmTransaction')
            expect(result.current.isAutoAdvancing).toBe(false)
        })

        it('auto-uses the prefilled destination for an opted-in ASA receiver', async () => {
            ;(useAccountBalancesQuery as Mock).mockReturnValue({
                accountBalances: new Map([
                    [
                        INTERNAL_OPTED_IN_ADDR,
                        { assetBalances: [{ assetId: ASA_ID }] },
                    ],
                ]),
            })
            ;(useSendFunds as Mock).mockReturnValue({
                selectedAssetId: ASA_ID,
                destination: INTERNAL_OPTED_IN_ADDR,
                setDestination: mockSetDestination,
                setSendMode: mockSetSendMode,
            })

            renderHook(() => useSelectDestinationScreen())
            await act(async () => {})

            expect(mockSetDestination).toHaveBeenCalledWith(
                INTERNAL_OPTED_IN_ADDR,
            )
            expect(mockNavigate).toHaveBeenCalledWith('ConfirmTransaction')
        })

        it('routes an unopted-in external prefilled receiver through the asset inbox', async () => {
            ;(useOnChainAccountStateQuery as Mock).mockReturnValue({
                data: { holdings: [] },
                isFetching: false,
                isSuccess: true,
                isError: false,
            })
            ;(useSendFunds as Mock).mockReturnValue({
                selectedAssetId: ASA_ID,
                destination: EXTERNAL_ADDR,
                setDestination: mockSetDestination,
                setSendMode: mockSetSendMode,
            })

            await act(async () => {
                renderHook(() => useSelectDestinationScreen())
            })

            expect(mockSetSendMode).toHaveBeenCalledWith('sendAssetInbox')
            expect(mockNavigate).toHaveBeenCalledWith('AssetInboxSendSummary')
        })

        it('shows the picker (no auto-advance) when no destination is prefilled', () => {
            const { result } = renderHook(() => useSelectDestinationScreen())

            expect(mockNavigate).not.toHaveBeenCalled()
            expect(result.current.isAutoAdvancing).toBe(false)
        })

        it('stops auto-advancing (no infinite spinner) when the deeplinked asset is not in the local DB', () => {
            // Asset query settled but the id resolves to nothing — an
            // TRANSFER of an ASA the user has never held.
            ;(useAssetsQuery as Mock).mockReturnValue({
                data: new Map(),
                isFetched: true,
            })
            ;(useSendFunds as Mock).mockReturnValue({
                selectedAssetId: ASA_ID,
                destination: EXTERNAL_ADDR,
                setDestination: mockSetDestination,
                setSendMode: mockSetSendMode,
            })

            const { result } = renderHook(() => useSelectDestinationScreen())

            // Bail so the error EmptyView renders instead of spinning forever.
            expect(result.current.isAutoAdvancing).toBe(false)
            expect(result.current.selectedAsset).toBeUndefined()
            expect(mockNavigate).not.toHaveBeenCalled()
        })

        it('waits for balances before routing a prefill (no opt-in misroute)', () => {
            // The deeplink resolves the instant this mounts; while balances are
            // pending the map is empty, which must NOT read as "not opted in".
            ;(useAccountBalancesQuery as Mock).mockReturnValue({
                accountBalances: new Map(),
                isPending: true,
            })
            ;(useSendFunds as Mock).mockReturnValue({
                selectedAssetId: ASA_ID,
                destination: INTERNAL_OPTED_IN_ADDR,
                setDestination: mockSetDestination,
                setSendMode: mockSetSendMode,
            })

            const { result } = renderHook(() => useSelectDestinationScreen())

            // Still waiting — crucially not misrouted to Express / ARC-59 off a
            // stale empty balance map.
            expect(result.current.isAutoAdvancing).toBe(true)
            expect(mockNavigate).not.toHaveBeenCalled()
            expect(mockSetSendMode).not.toHaveBeenCalled()
        })
    })

    // The send sheet disables swipe/backdrop dismissal, so when this screen is
    // the flow's initial route (a pure-NFT transfer skips the amount step) it
    // must offer its own close — otherwise the sheet strands the user with no
    // back button and no way out.
    describe('close control as the flow root', () => {
        it('exposes a close that tears down the flow when it is the stack root', () => {
            mockStackRoutes.mockReturnValue([{ key: ROUTE_KEY }])

            const { result } = renderHook(() => useSelectDestinationScreen())

            expect(result.current.canClose).toBe(true)

            act(() => {
                result.current.onClose()
            })

            expect(mockOnFinished).toHaveBeenCalled()
        })

        it('defers to the header back button when it was pushed onto the stack', () => {
            mockStackRoutes.mockReturnValue([
                { key: 'input-amount' },
                { key: ROUTE_KEY },
            ])

            const { result } = renderHook(() => useSelectDestinationScreen())

            expect(result.current.canClose).toBe(false)
        })

        // Picking a receiver writes the destination and pushes the next screen
        // in the same tick, so this screen re-renders with a route above it.
        // The close must survive that render or popping back strands the sheet.
        it('keeps the close while a later screen sits on top of the root', () => {
            mockStackRoutes.mockReturnValue([
                { key: ROUTE_KEY },
                { key: 'express-send' },
            ])

            const { result } = renderHook(() => useSelectDestinationScreen())

            expect(result.current.canClose).toBe(true)
        })
    })

    describe('NFD destinations', () => {
        const NFD_NAME = 'alice.algo'
        const algoSend = () =>
            (useSendFunds as Mock).mockReturnValue({
                selectedAssetId: '0',
                setDestination: mockSetDestination,
                setSendMode: mockSetSendMode,
            })

        it('routes a plain address without consulting the contract', async () => {
            algoSend()
            const { result } = renderHook(() => useSelectDestinationScreen())

            await act(async () => {
                result.current.handleSelected(EXTERNAL_ADDR)
            })

            expect(mockVerifyNameAddress).not.toHaveBeenCalled()
            expect(mockNavigate).toHaveBeenCalledWith('ConfirmTransaction')
        })

        it('routes a name only after the contract vouches for its address', async () => {
            algoSend()
            mockVerifyNameAddress.mockResolvedValue('verified')
            const { result } = renderHook(() => useSelectDestinationScreen())

            await act(async () => {
                result.current.handleSelected(EXTERNAL_ADDR, NFD_NAME)
            })

            expect(mockVerifyNameAddress).toHaveBeenCalledWith(
                expect.objectContaining({
                    name: NFD_NAME,
                    address: EXTERNAL_ADDR,
                    scope: { chainId: 'algorand', networkId: 'testnet' },
                }),
            )
            expect(mockSetDestination).toHaveBeenCalledWith(EXTERNAL_ADDR)
            expect(mockNavigate).toHaveBeenCalledWith('ConfirmTransaction')
        })

        it('blocks a name whose address the contract does not list', async () => {
            algoSend()
            mockVerifyNameAddress.mockResolvedValue('mismatch')
            const { result } = renderHook(() => useSelectDestinationScreen())

            await act(async () => {
                result.current.handleSelected(EXTERNAL_ADDR, NFD_NAME)
            })

            expect(mockSetDestination).not.toHaveBeenCalled()
            expect(mockNavigate).not.toHaveBeenCalled()
            expect(mockErrorToast).toHaveBeenCalledWith(
                'send_funds.destination.nfd_mismatch_title',
                expect.any(String),
            )
            expect(result.current.isCheckingExternalOptIn).toBe(false)
        })

        it('blocks, rather than trusts, when the contract cannot be read', async () => {
            algoSend()
            mockVerifyNameAddress.mockResolvedValue('unavailable')
            const { result } = renderHook(() => useSelectDestinationScreen())

            await act(async () => {
                result.current.handleSelected(EXTERNAL_ADDR, NFD_NAME)
            })

            expect(mockNavigate).not.toHaveBeenCalled()
            expect(mockErrorToast).toHaveBeenCalledWith(
                'send_funds.destination.nfd_unavailable_title',
                expect.any(String),
            )
        })
    })

    describe('what the picker shows for the send chain', () => {
        it("excludes the sender's address on the send chain, not its default chain", () => {
            mockSendScope.value = { chainId: 'ethereum', networkId: 'testnet' }
            mockSelectedAccount.value = {
                id: 'sender',
                custody: { kind: 'watch' },
                chains: {
                    algorand: { address: 'SENDERADDR' },
                    ethereum: { address: '0xSENDER' },
                },
            }

            const { result } = renderHook(() => useSelectDestinationScreen())

            expect(result.current.senderAddress).toBe('0xSENDER')
        })

        it('has no sender address to exclude on a chain the account is not on', () => {
            mockSendScope.value = { chainId: 'ethereum', networkId: 'testnet' }

            const { result } = renderHook(() => useSelectDestinationScreen())

            expect(result.current.senderAddress).toBeUndefined()
        })

        it('passes on the chain name the header badge shows', () => {
            mockChainName.value = 'Ethereum'

            const { result } = renderHook(() => useSelectDestinationScreen())

            expect(result.current.chainBadgeName).toBe('Ethereum')
        })
    })
})
