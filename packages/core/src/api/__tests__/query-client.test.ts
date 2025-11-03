import { describe, test, expect, beforeEach, vi } from 'vitest'

// Mock the config
const configMock = vi.hoisted(() => ({
    debugEnabled: false,
}))
vi.mock('@perawallet/config', () => ({
    config: configMock,
}))

// Mock zustand store
const storeMock = vi.hoisted(() => {
    let state: any = { network: 'mainnet' }
    return {
        create() {
            const useAppStore: any = (selector: any) => selector(state)
            ;(useAppStore as any).getState = () => state
            ;(useAppStore as any).setState = (partial: any) => {
                state = { ...state, ...partial }
            }
            return { useAppStore }
        },
    }
})
vi.mock('@store/app-store', () => storeMock.create())

// Mock console.log
const consoleMock = vi.spyOn(console, 'log').mockImplementation(() => {})

describe('api/query-client', () => {
    beforeEach(() => {
        vi.resetModules()
        consoleMock.mockClear()
        configMock.debugEnabled = false
    })

    test('logRequest logs when debugEnabled is true', async () => {
        configMock.debugEnabled = true

        const { logRequest } = await import('../query-client')

        const mockRequest = {
            url: 'https://example.com/api/test',
            method: 'GET',
            headers: new Headers(),
        } as any

        logRequest(mockRequest)

        expect(consoleMock).toHaveBeenCalledWith('Sending request', mockRequest)
    })

    test('logRequest does not log when debugEnabled is false', async () => {
        configMock.debugEnabled = false

        const { logRequest } = await import('../query-client')

        const mockRequest = {
            url: 'https://example.com/api/test',
            method: 'GET',
            headers: new Headers(),
        } as any

        logRequest(mockRequest)

        expect(consoleMock).not.toHaveBeenCalled()
    })

    test('logResponse logs when debugEnabled is true', async () => {
        configMock.debugEnabled = true

        const { logResponse } = await import('../query-client')

        const mockRequest = {
            url: 'https://example.com/api/test',
            method: 'GET',
            headers: new Headers(),
        } as any

        const mockResponse = {
            url: 'https://example.com/api/test',
            status: 200,
            statusText: 'OK',
            headers: new Headers(),
        } as any

        logResponse(mockRequest, {}, mockResponse)

        expect(consoleMock).toHaveBeenCalledWith(
            'Received response',
            mockResponse,
        )
    })

    test('logResponse does not log when debugEnabled is false', async () => {
        configMock.debugEnabled = false

        const { logResponse } = await import('../query-client')

        const mockRequest = {
            url: 'https://example.com/api/test',
            method: 'GET',
            headers: new Headers(),
        } as any

        const mockResponse = {
            url: 'https://example.com/api/test',
            status: 200,
            statusText: 'OK',
            headers: new Headers(),
        } as any

        logResponse(mockRequest, {}, mockResponse)

        expect(consoleMock).not.toHaveBeenCalled()
    })

    test('createFetchClient throws error when URL is missing', async () => {
        const { createFetchClient } = await import('../query-client')

        const clients = new Map()
        const fetchClient = createFetchClient(clients)

        await expect(fetchClient({ method: 'GET' } as any)).rejects.toThrow(
            'URL is required',
        )
    })

    test('createFetchClient throws error when client is not found', async () => {
        const { createFetchClient } = await import('../query-client')

        const clients = new Map()
        const fetchClient = createFetchClient(clients)

        // Mock useAppStore to return a network that doesn't exist in clients
        const { useAppStore } = await import('@store/app-store')
        useAppStore.setState({ network: 'devnet' as any })

        await expect(
            fetchClient({ url: '/test', method: 'GET' }),
        ).rejects.toThrow('Could not get KY client')
    })

    test('createFetchClient logs error and re-throws when request fails', async () => {
        const { createFetchClient } = await import('../query-client')
        const { useAppStore } = await import('@store/app-store')

        const throwingClient = vi.fn(() => {
            throw new Error('Network error')
        })
        const clients = new Map([['mainnet', throwingClient as any]])
        const fetchClient = createFetchClient(clients)

        useAppStore.setState({ network: 'mainnet' })
        configMock.debugEnabled = true

        await expect(
            fetchClient({ url: '/test', method: 'GET' }),
        ).rejects.toThrow('Network error')

        expect(consoleMock).toHaveBeenCalledWith(
            'Query error',
            expect.any(Error),
        )
    })
})
