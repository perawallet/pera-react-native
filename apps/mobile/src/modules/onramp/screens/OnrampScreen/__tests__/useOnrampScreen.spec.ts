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
    useRampPairsQuery,
    useRampRegionQuery,
    useOnramp,
    type RampPair,
} from '@perawallet/wallet-core-onramp'
import { useSelectedAccountAddress } from '@perawallet/wallet-core-accounts'
import { useRoute } from '@react-navigation/native'

import { useOnrampScreen } from '../useOnrampScreen'

vi.mock('@perawallet/wallet-core-onramp', () => ({
    useRampPairsQuery: vi.fn(),
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

vi.mock('@perawallet/wallet-core-accounts', () => ({
    useSelectedAccountAddress: vi.fn(),
}))

vi.mock('@react-navigation/native', () => ({
    useRoute: vi.fn(),
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

vi.mock('@analytics', () => ({
    trackEvent: vi.fn(),
    OnrampEvent: {
        WelcomeContinue: 'WelcomeContinue',
        HistoryTabSelect: 'HistoryTabSelect',
    },
}))

const makePair = (
    id: string,
    sourceTokenId: string,
    destinationTokenId: string,
): RampPair =>
    ({
        id,
        sourceToken: { id: sourceTokenId },
        destinationToken: { id: destinationTokenId },
        provider: { id: 'provider' },
    }) as unknown as RampPair

const PAIR_A = makePair('pair-a', 'USD', 'ALGO')
const PAIR_B = makePair('pair-b', 'EUR', '31566704')
const PAIRS = [PAIR_A, PAIR_B]

type MockRampPairsQueryOverrides = {
    data?: RampPair[]
    isLoading?: boolean
    isError?: boolean
    fetchStatus?: 'fetching' | 'paused' | 'idle'
    status?: 'pending' | 'error' | 'success'
    refetch?: () => void
}

const mockRampPairsQuery = ({
    data,
    isLoading = false,
    isError = false,
    fetchStatus = 'idle',
    status = 'success',
    refetch = vi.fn(),
}: MockRampPairsQueryOverrides): void => {
    vi.mocked(useRampPairsQuery).mockReturnValue({
        data,
        isLoading,
        isError,
        fetchStatus,
        status,
        refetch,
    } as never)
}

const mockSetSelectedSourceTokenId = vi.fn()
const mockSetSelectedDestinationTokenId = vi.fn()

const setupOnramp = (overrides: Partial<ReturnType<typeof useOnramp>> = {}) => {
    vi.mocked(useOnramp).mockReturnValue({
        selectedSourceTokenId: null,
        selectedDestinationTokenId: null,
        senderAddress: '',
        setSelectedSourceTokenId: mockSetSelectedSourceTokenId,
        setSelectedDestinationTokenId: mockSetSelectedDestinationTokenId,
        setSenderAddress: vi.fn(),
        ...overrides,
    })
}

describe('useOnrampScreen', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        setHasInternet(true)
        vi.mocked(useRoute).mockReturnValue({ params: undefined } as never)
        vi.mocked(useRampRegionQuery).mockReturnValue({
            data: { countryCode: 'US', countryName: 'United States' },
        } as never)
        vi.mocked(useSelectedAccountAddress).mockReturnValue({
            selectedAccountAddress: 'ADDR',
            setSelectedAccountAddress: vi.fn(),
        })
        vi.mocked(useRampPairsQuery).mockReturnValue({
            data: PAIRS,
            isLoading: false,
        } as never)
        setupOnramp()
    })

    it('defaults the destination to ALGO and leaves the source unset when nothing is selected', () => {
        renderHook(() => useOnrampScreen())

        expect(mockSetSelectedDestinationTokenId).toHaveBeenCalledWith('ALGO')
        expect(mockSetSelectedSourceTokenId).not.toHaveBeenCalled()
    })

    it('seeds the destination from the route destinationTokenId param', () => {
        vi.mocked(useRoute).mockReturnValue({
            params: { destinationTokenId: '31566704' },
        } as never)

        renderHook(() => useOnrampScreen())

        expect(mockSetSelectedDestinationTokenId).toHaveBeenCalledWith(
            '31566704',
        )
        expect(mockSetSelectedSourceTokenId).not.toHaveBeenCalled()
    })

    it('seeds the source only from a matching route sourceTokenId param', () => {
        vi.mocked(useRoute).mockReturnValue({
            params: { sourceTokenId: 'USD' },
        } as never)

        renderHook(() => useOnrampScreen())

        expect(mockSetSelectedSourceTokenId).toHaveBeenCalledWith('USD')
    })

    it('resolves selectedPair only when both source and destination are set', () => {
        setupOnramp({
            selectedSourceTokenId: 'USD',
            selectedDestinationTokenId: 'ALGO',
        })

        const { result } = renderHook(() => useOnrampScreen())

        expect(result.current.selectedPair).toBe(PAIR_A)
        expect(result.current.sourceToken).toBe(PAIR_A.sourceToken)
        expect(result.current.destinationToken).toBe(PAIR_A.destinationToken)
    })

    it('leaves selectedPair null when only the destination is set', () => {
        setupOnramp({ selectedDestinationTokenId: 'ALGO' })

        const { result } = renderHook(() => useOnrampScreen())

        expect(result.current.selectedPair).toBeNull()
        expect(result.current.sourceToken).toBeNull()
        expect(result.current.destinationToken).toBe(PAIR_A.destinationToken)
    })

    it('is not ready while pairs are loading and ready once a destination resolves', () => {
        vi.mocked(useRampPairsQuery).mockReturnValue({
            data: undefined,
            isLoading: true,
        } as never)

        const { result, rerender } = renderHook(() => useOnrampScreen())

        expect(result.current.isReady).toBe(false)

        vi.mocked(useRampPairsQuery).mockReturnValue({
            data: PAIRS,
            isLoading: false,
        } as never)
        setupOnramp({ selectedDestinationTokenId: 'ALGO' })
        rerender()

        expect(result.current.isReady).toBe(true)
    })

    describe('pairsState', () => {
        it('is offline when the pairs query is paused with no cached data (true-offline, uncached)', () => {
            mockRampPairsQuery({
                data: undefined,
                isLoading: true,
                isError: false,
                fetchStatus: 'paused',
                status: 'pending',
            })
            const { result } = renderHook(() => useOnrampScreen())
            expect(result.current.pairsState).toBe('offline')
        })

        it('is ready with cached pairs even while paused (stale allowed)', () => {
            setupOnramp({ selectedDestinationTokenId: 'ALGO' })
            mockRampPairsQuery({
                data: PAIRS,
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
            mockRampPairsQuery({
                data: undefined,
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
            mockRampPairsQuery({
                data: undefined,
                isLoading: false,
                isError: true,
                fetchStatus: 'idle',
                status: 'error',
            })
            const { result } = renderHook(() => useOnrampScreen())
            expect(result.current.pairsState).toBe('error')
        })

        it('is loading while genuinely fetching', () => {
            mockRampPairsQuery({
                data: undefined,
                isLoading: true,
                isError: false,
                fetchStatus: 'fetching',
                status: 'pending',
            })
            const { result } = renderHook(() => useOnrampScreen())
            expect(result.current.pairsState).toBe('loading')
        })

        it('handleRetryPairs refetches the pairs query', () => {
            const refetch = vi.fn()
            mockRampPairsQuery({
                data: undefined,
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
})
