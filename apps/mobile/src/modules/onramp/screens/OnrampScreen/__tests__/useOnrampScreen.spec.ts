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

import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
    useRampDestinationsQuery,
    useRampRegionQuery,
    useRampSourcesQuery,
    useOnramp,
    type RampToken,
} from '@perawallet/wallet-core-onramp'
import { useIsFocused, useNavigation, useRoute } from '@react-navigation/native'
import { useBottomSheet } from '@modules/bottom-sheet'
import { useOnrampAccount } from '@modules/onramp/hooks/useOnrampAccount'

import { registerAlgorandRampAdapter } from '@test-utils/rampChainAdapter'
import {
    ALGO_ROUTER_ID,
    USDC_ROUTER_ID,
    makeAlgoToken,
    makeFiatToken,
    makeRampToken,
} from '@test-utils/rampFixtures'
import { useOnrampIntroduction } from '../useOnrampIntroduction'
import { useOnrampScreen } from '../useOnrampScreen'
import { IntegrityRequiredError } from '@perawallet/wallet-core-shared'

vi.mock(import('@perawallet/wallet-core-onramp'), async importOriginal => ({
    ...(await importOriginal()),
    useRampDestinationsQuery: vi.fn(),
    useRampSourcesQuery: vi.fn(),
    useRampRegionQuery: vi.fn(),
    useOnramp: vi.fn(),
}))

let hasInternetMock = true

vi.mock('@modules/network', () => ({
    useNetworkStatus: () => ({ hasInternet: hasInternetMock }),
}))

const setHasInternet = (hasInternet: boolean): void => {
    hasInternetMock = hasInternet
}

vi.mock('@modules/onramp/hooks/useOnrampAccount', () => ({
    useOnrampAccount: vi.fn(),
}))

const SCOPE = { chainId: 'algorand', networkId: 'mainnet' } as const

const fundableAccount = (): ReturnType<typeof useOnrampAccount> => ({
    account: null,
    scope: SCOPE,
    address: 'ADDR',
})

vi.mock('@react-navigation/native', () => ({
    useIsFocused: vi.fn(),
    useRoute: vi.fn(),
    useNavigation: vi.fn(),
}))

vi.mock('../useOnrampIntroduction', () => ({
    useOnrampIntroduction: vi.fn(() => ({
        isIntroductionSeen: true,
        markIntroductionSeen: vi.fn(),
    })),
}))

vi.mock('@modules/bottom-sheet', () => ({
    useBottomSheet: vi.fn(() => ({
        request: vi.fn().mockResolvedValue(undefined),
    })),
}))

// The hook references these only inside sheet callbacks (not exercised by the
// seeding tests); stub them so importing the hook doesn't pull the analytics /
// navigation-ref module graph the unit project doesn't mock.
vi.mock('@modules/onramp/components', () => ({
    OnrampCountryInfoContent: () => null,
    OnrampIntroductionContent: () => null,
}))

vi.mock('@modules/onramp/hooks/useTrackOnrampEvent', () => ({
    useTrackOnrampEvent: () => vi.fn(),
}))

vi.mock('@analytics', () => ({
    trackEvent: vi.fn(),
    OnrampEvent: {
        WelcomeContinue: 'WelcomeContinue',
        HistoryTabSelect: 'HistoryTabSelect',
    },
}))

const ALGO = makeAlgoToken()
const USDC = makeRampToken()
const USD = makeFiatToken('USD')
const DESTINATIONS = [USDC, ALGO]
const SOURCES = [USD, makeFiatToken('EUR')]

type MockQueryOverrides = {
    data?: RampToken[]
    isLoading?: boolean
    isError?: boolean
    fetchStatus?: 'fetching' | 'paused' | 'idle'
    status?: 'pending' | 'error' | 'success'
    refetch?: () => void
    error?: unknown
}

const mockDestinationsQuery = ({
    data = [],
    isLoading = false,
    isError = false,
    fetchStatus = 'idle',
    status = 'success',
    refetch = vi.fn(),
    error = null,
}: MockQueryOverrides): void => {
    vi.mocked(useRampDestinationsQuery).mockReturnValue({
        data,
        isLoading,
        isError,
        fetchStatus,
        status,
        refetch,
        error,
    } as never)
}

const mockSetSelectedSourceTokenId = vi.fn()
const mockSetSelectedDestinationTokenId = vi.fn()
const mockSetSelectedChainId = vi.fn()
const mockSetParams = vi.fn()

const setupOnramp = (overrides: Partial<ReturnType<typeof useOnramp>> = {}) => {
    vi.mocked(useOnramp).mockReturnValue({
        selectedSourceTokenId: null,
        selectedDestinationTokenId: null,
        selectedChainId: null,
        senderAddress: '',
        setSelectedSourceTokenId: mockSetSelectedSourceTokenId,
        setSelectedDestinationTokenId: mockSetSelectedDestinationTokenId,
        setSelectedChainId: mockSetSelectedChainId,
        setSenderAddress: vi.fn(),
        rememberDepositInstructions: vi.fn(),
        ...overrides,
    })
}

describe('useOnrampScreen', () => {
    beforeEach(() => {
        registerAlgorandRampAdapter()
        vi.clearAllMocks()
        setHasInternet(true)
        vi.mocked(useRoute).mockReturnValue({ params: undefined } as never)
        vi.mocked(useIsFocused).mockReturnValue(true)
        vi.mocked(useNavigation).mockReturnValue({
            setParams: mockSetParams,
        } as never)
        vi.mocked(useRampRegionQuery).mockReturnValue({
            data: { countryCode: 'US', countryName: 'United States' },
        } as never)
        vi.mocked(useOnrampAccount).mockReturnValue(fundableAccount())
        mockDestinationsQuery({ data: DESTINATIONS })
        vi.mocked(useRampSourcesQuery).mockReturnValue({
            data: SOURCES,
        } as never)
        setupOnramp()
    })

    it('defaults the destination to the native coin and leaves the source unset when nothing is selected', () => {
        renderHook(() => useOnrampScreen())

        expect(mockSetSelectedDestinationTokenId).toHaveBeenCalledWith(
            ALGO_ROUTER_ID,
        )
        expect(mockSetSelectedSourceTokenId).not.toHaveBeenCalled()
    })

    it('falls back to the first destination when none is the native coin', () => {
        mockDestinationsQuery({ data: [USDC] })

        renderHook(() => useOnrampScreen())

        expect(mockSetSelectedDestinationTokenId).toHaveBeenCalledWith(
            USDC_ROUTER_ID,
        )
    })

    it('reseeds a remembered destination the router no longer lists, such as a v1 catalogue id', () => {
        setupOnramp({ selectedDestinationTokenId: 'USDC_ALGORAND' })

        renderHook(() => useOnrampScreen())

        expect(mockSetSelectedDestinationTokenId).toHaveBeenCalledWith(
            ALGO_ROUTER_ID,
        )
    })

    it('keeps a remembered destination the router lists', () => {
        setupOnramp({ selectedDestinationTokenId: USDC_ROUTER_ID })

        renderHook(() => useOnrampScreen())

        expect(mockSetSelectedDestinationTokenId).not.toHaveBeenCalled()
    })

    it('neither seeds nor asks for destinations while the account cannot be funded', () => {
        vi.mocked(useOnrampAccount).mockReturnValue({
            account: null,
            scope: null,
            address: null,
        })

        const { result } = renderHook(() => useOnrampScreen())

        expect(useRampDestinationsQuery).toHaveBeenCalledWith({ scope: null })
        expect(mockSetSelectedDestinationTokenId).not.toHaveBeenCalled()
        expect(result.current.canFundSelectedAccount).toBe(false)
    })

    describe('the route', () => {
        const routeTo = (params: {
            chainId: string
            destinationAssetId?: string
        }) => vi.mocked(useRoute).mockReturnValue({ params } as never)

        it("writes the route's chain to the store", () => {
            routeTo({ chainId: 'ethereum' })

            renderHook(() => useOnrampScreen())

            expect(mockSetSelectedChainId).toHaveBeenCalledWith('ethereum')
        })

        it('writes no chain without a route', () => {
            renderHook(() => useOnrampScreen())

            expect(mockSetSelectedChainId).not.toHaveBeenCalled()
        })

        it("selects the route's asset, matched through the chain's adapter, over a remembered destination", () => {
            setupOnramp({ selectedDestinationTokenId: ALGO_ROUTER_ID })
            routeTo({ chainId: 'algorand', destinationAssetId: '31566704' })

            renderHook(() => useOnrampScreen())

            expect(mockSetSelectedDestinationTokenId).toHaveBeenLastCalledWith(
                USDC_ROUTER_ID,
            )
            expect(mockSetSelectedSourceTokenId).not.toHaveBeenCalled()
        })

        it('spends the route once applied', () => {
            routeTo({ chainId: 'algorand', destinationAssetId: '31566704' })

            renderHook(() => useOnrampScreen())

            expect(mockSetParams).toHaveBeenCalledWith({
                chainId: undefined,
                destinationAssetId: undefined,
            })
        })

        it('spends a route that names only a chain once the scope is that chain', () => {
            routeTo({ chainId: 'algorand' })

            renderHook(() => useOnrampScreen())

            expect(mockSetParams).toHaveBeenCalledTimes(1)
            expect(mockSetSelectedDestinationTokenId).toHaveBeenCalledTimes(1)
        })

        it("waits for the scope to be the route's chain", () => {
            routeTo({ chainId: 'ethereum', destinationAssetId: '31566704' })

            renderHook(() => useOnrampScreen())

            expect(mockSetParams).not.toHaveBeenCalled()
            expect(mockSetSelectedDestinationTokenId).toHaveBeenCalledTimes(1)
            expect(mockSetSelectedDestinationTokenId).toHaveBeenCalledWith(
                ALGO_ROUTER_ID,
            )
        })

        it("waits for the router's list before applying the route's asset", () => {
            routeTo({ chainId: 'algorand', destinationAssetId: '31566704' })
            mockDestinationsQuery({ data: [], isLoading: true })

            renderHook(() => useOnrampScreen())

            expect(mockSetParams).not.toHaveBeenCalled()
        })

        it('keeps the selection, and still spends the route, for an asset the router no longer lists', () => {
            setupOnramp({ selectedDestinationTokenId: USDC_ROUTER_ID })
            routeTo({ chainId: 'algorand', destinationAssetId: '999' })

            renderHook(() => useOnrampScreen())

            expect(mockSetSelectedDestinationTokenId).not.toHaveBeenCalled()
            expect(mockSetParams).toHaveBeenCalledTimes(1)
        })

        it('does not overwrite a later pick once the route is spent', () => {
            setupOnramp({ selectedDestinationTokenId: ALGO_ROUTER_ID })
            routeTo({ chainId: 'algorand', destinationAssetId: '31566704' })
            const { rerender } = renderHook(() => useOnrampScreen())
            mockSetSelectedDestinationTokenId.mockClear()

            vi.mocked(useRoute).mockReturnValue({ params: undefined } as never)
            rerender()

            expect(mockSetSelectedDestinationTokenId).not.toHaveBeenCalled()
        })
    })

    it('resolves selectedPair only when both source and destination are set', () => {
        setupOnramp({
            selectedSourceTokenId: USD.id,
            selectedDestinationTokenId: ALGO_ROUTER_ID,
        })

        const { result } = renderHook(() => useOnrampScreen())

        expect(result.current.selectedPair).toEqual({
            id: `${USD.id}|${ALGO_ROUTER_ID}`,
            sourceToken: USD,
            destinationToken: ALGO,
        })
        expect(result.current.sourceToken).toBe(USD)
        expect(result.current.destinationToken).toBe(ALGO)
    })

    it("reads the sources of the selected destination, and none for one the router doesn't list", () => {
        setupOnramp({ selectedDestinationTokenId: ALGO_ROUTER_ID })
        renderHook(() => useOnrampScreen())

        expect(useRampSourcesQuery).toHaveBeenCalledWith({
            scope: SCOPE,
            destinationId: ALGO_ROUTER_ID,
        })

        setupOnramp({ selectedDestinationTokenId: 'stale' })
        renderHook(() => useOnrampScreen())

        expect(useRampSourcesQuery).toHaveBeenLastCalledWith({
            scope: SCOPE,
            destinationId: null,
        })
    })

    it('leaves selectedPair null when only the destination is set', () => {
        setupOnramp({ selectedDestinationTokenId: ALGO_ROUTER_ID })

        const { result } = renderHook(() => useOnrampScreen())

        expect(result.current.selectedPair).toBeNull()
        expect(result.current.sourceToken).toBeNull()
        expect(result.current.destinationToken).toBe(ALGO)
    })

    it('leaves the source null when the selected one is not a source of the destination', () => {
        setupOnramp({
            selectedSourceTokenId: 'gone',
            selectedDestinationTokenId: ALGO_ROUTER_ID,
        })

        const { result } = renderHook(() => useOnrampScreen())

        expect(result.current.sourceToken).toBeNull()
        expect(result.current.selectedPair).toBeNull()
    })

    it('is not ready while destinations are loading and ready once a destination resolves', () => {
        mockDestinationsQuery({ data: [], isLoading: true })

        const { result, rerender } = renderHook(() => useOnrampScreen())

        expect(result.current.isReady).toBe(false)

        mockDestinationsQuery({ data: DESTINATIONS })
        setupOnramp({ selectedDestinationTokenId: ALGO_ROUTER_ID })
        rerender()

        expect(result.current.isReady).toBe(true)
    })

    describe('pairsState', () => {
        it('is offline when the query is paused with no cached data (true-offline, uncached)', () => {
            mockDestinationsQuery({
                isLoading: true,
                isError: false,
                fetchStatus: 'paused',
                status: 'pending',
            })
            const { result } = renderHook(() => useOnrampScreen())
            expect(result.current.pairsState).toBe('offline')
        })

        it('is ready with cached destinations even while paused (stale allowed)', () => {
            setupOnramp({ selectedDestinationTokenId: ALGO_ROUTER_ID })
            mockDestinationsQuery({
                data: DESTINATIONS,
                isLoading: false,
                isError: false,
                fetchStatus: 'paused',
                status: 'success',
            })
            const { result } = renderHook(() => useOnrampScreen())
            expect(result.current.pairsState).toBe('ready')
        })

        it('is offline when the query errored and the device has no internet', () => {
            setHasInternet(false)
            mockDestinationsQuery({
                isLoading: false,
                isError: true,
                fetchStatus: 'idle',
                status: 'error',
            })
            const { result } = renderHook(() => useOnrampScreen())
            expect(result.current.pairsState).toBe('offline')
        })

        it('is error when the query errored while online (fake-online regime)', () => {
            setHasInternet(true)
            mockDestinationsQuery({
                isLoading: false,
                isError: true,
                fetchStatus: 'idle',
                status: 'error',
            })
            const { result } = renderHook(() => useOnrampScreen())
            expect(result.current.pairsState).toBe('error')
            expect(result.current.isPairsIntegrityBlocked).toBe(false)
        })

        it('flags the integrity arm when the destinations were refused for the token', () => {
            mockDestinationsQuery({
                isError: true,
                status: 'error',
                error: new IntegrityRequiredError({
                    code: 'APP_INTEGRITY_TOKEN_REQUIRED',
                    status: 403,
                    hadToken: false,
                }),
            })
            const { result } = renderHook(() => useOnrampScreen())
            expect(result.current.isPairsIntegrityBlocked).toBe(true)
        })

        it('is error, so the user can retry, when the query settled with no destinations', () => {
            mockDestinationsQuery({
                data: [],
                isLoading: false,
                isError: false,
                fetchStatus: 'idle',
                status: 'success',
            })
            const { result } = renderHook(() => useOnrampScreen())
            expect(result.current.isReady).toBe(false)
            expect(result.current.pairsState).toBe('error')
        })

        it('drops a chosen chain whose list settled empty, so Fund does not stay on the retry state', () => {
            setupOnramp({ selectedChainId: 'ethereum' })
            mockDestinationsQuery({ data: [], fetchStatus: 'idle' })

            renderHook(() => useOnrampScreen())

            expect(mockSetSelectedChainId).toHaveBeenCalledWith(null)
        })

        it('keeps a chosen chain when its list failed to load', () => {
            setupOnramp({ selectedChainId: 'ethereum' })
            mockDestinationsQuery({
                isError: true,
                status: 'error',
                fetchStatus: 'idle',
            })

            renderHook(() => useOnrampScreen())

            expect(mockSetSelectedChainId).not.toHaveBeenCalled()
        })

        it('keeps a chosen chain while its list is still loading', () => {
            setupOnramp({ selectedChainId: 'ethereum' })
            mockDestinationsQuery({
                isLoading: true,
                fetchStatus: 'fetching',
                status: 'pending',
            })

            renderHook(() => useOnrampScreen())

            expect(mockSetSelectedChainId).not.toHaveBeenCalled()
        })

        it('is loading while genuinely fetching', () => {
            mockDestinationsQuery({
                isLoading: true,
                isError: false,
                fetchStatus: 'fetching',
                status: 'pending',
            })
            const { result } = renderHook(() => useOnrampScreen())
            expect(result.current.pairsState).toBe('loading')
        })

        it('handleRetryPairs refetches the destinations query', () => {
            const refetch = vi.fn()
            mockDestinationsQuery({
                isLoading: false,
                isError: true,
                fetchStatus: 'idle',
                status: 'error',
                refetch,
            })
            const { result } = renderHook(() => useOnrampScreen())
            act(() => result.current.handleRetryPairs())
            expect(refetch).toHaveBeenCalled()
        })
    })

    describe('introduction sheet', () => {
        const request = vi.fn()

        beforeEach(() => {
            request.mockResolvedValue(undefined)
            vi.mocked(useBottomSheet).mockReturnValue({ request } as never)
            vi.mocked(useOnrampIntroduction).mockReturnValue({
                isIntroductionSeen: false,
                markIntroductionSeen: vi.fn(),
            })
        })

        it('opens once the screen is focused', () => {
            renderHook(() => useOnrampScreen())
            expect(request).toHaveBeenCalledTimes(1)
        })

        it('stays closed while another tab is focused', () => {
            vi.mocked(useIsFocused).mockReturnValue(false)
            renderHook(() => useOnrampScreen())
            expect(request).not.toHaveBeenCalled()
        })
    })
})
