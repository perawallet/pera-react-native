import { describe, test, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement, type ReactNode } from 'react'
import { useApplicationQuery } from '../useApplicationQuery'
import * as applicationsEndpoints from '../../api/applications/endpoints'
import type { PeraApplication } from '../../models/types'

vi.mock('../../api/applications/endpoints')

vi.mock('@perawallet/wallet-core-platform-integration', () => ({
    useNetwork: vi.fn(() => ({ network: 'mainnet', setNetwork: vi.fn() })),
}))

const mockApplication: PeraApplication = {
    applicationId: 123456,
    name: 'Tinyman AMM',
    project: {
        name: 'Tinyman',
        verificationTier: 'verified',
    },
}

const createWrapper = () => {
    const queryClient = new QueryClient({
        defaultOptions: {
            queries: { retry: false },
        },
    })
    return ({ children }: { children: ReactNode }) =>
        createElement(QueryClientProvider, { client: queryClient }, children)
}

describe('useApplicationQuery', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    test('fetches application by ID', async () => {
        vi.mocked(applicationsEndpoints.fetchApplication).mockResolvedValue(
            mockApplication,
        )

        const { result } = renderHook(
            () =>
                useApplicationQuery({
                    applicationId: '123456',
                }),
            { wrapper: createWrapper() },
        )

        expect(result.current.isLoading).toBe(true)

        await waitFor(() => {
            expect(result.current.isLoading).toBe(false)
        })

        expect(result.current.data).toEqual(mockApplication)
        expect(result.current.isError).toBe(false)
    })

    test('is disabled when applicationId is empty', () => {
        const { result } = renderHook(
            () =>
                useApplicationQuery({
                    applicationId: '',
                }),
            { wrapper: createWrapper() },
        )

        expect(result.current.isLoading).toBe(false)
        expect(result.current.data).toBeUndefined()
        expect(applicationsEndpoints.fetchApplication).not.toHaveBeenCalled()
    })

    test('is disabled when isEnabled is false', () => {
        const { result } = renderHook(
            () =>
                useApplicationQuery({
                    applicationId: '123456',
                    isEnabled: false,
                }),
            { wrapper: createWrapper() },
        )

        expect(result.current.isLoading).toBe(false)
        expect(applicationsEndpoints.fetchApplication).not.toHaveBeenCalled()
    })

    test('handles errors', async () => {
        vi.mocked(applicationsEndpoints.fetchApplication).mockRejectedValue(
            new Error('Not found'),
        )

        const { result } = renderHook(
            () =>
                useApplicationQuery({
                    applicationId: '999999',
                }),
            { wrapper: createWrapper() },
        )

        await waitFor(() => {
            expect(result.current.isError).toBe(true)
        })

        expect(result.current.error).toBeInstanceOf(Error)
        expect(result.current.data).toBeUndefined()
    })
})
