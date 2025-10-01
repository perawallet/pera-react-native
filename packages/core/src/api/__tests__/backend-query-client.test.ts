import { describe, test, expect, beforeEach, vi } from 'vitest'

// Mock the config
const configMock = vi.hoisted(() => ({
    backendAPIKey: '',
    mainnetBackendUrl: 'https://mainnet.backend.example.com',
    testnetBackendUrl: 'https://testnet.backend.example.com',
    debugEnabled: false,
}))
vi.mock('../../config/main', () => ({
    config: configMock,
}))

// Mocks for ky and zustand store (alias: @store/app-store)

const kyState = vi.hoisted(() => {
    let createCalls: any[] = []
    let extendCalls: any[] = []
    let callRecords: { label: string; input: any; options: any }[] = []
    let index = 0

    const makeInstance = (label: string) => {
        const instance = vi.fn(async (input: any, options: any) => {
            callRecords.push({ label, input, options })
            return {
                async json() {
                    return { ok: label }
                },
                status: 200,
                statusText: 'OK',
            } as any
        })

        // Add extend method to mock ky instance
        ;(instance as any).extend = vi.fn((opts: any) => {
            extendCalls.push(opts)
            const extendedLabel = `${label}-extended`
            return makeInstance(extendedLabel)
        })

        return instance
    }

    const create = vi.fn((opts: any) => {
        createCalls.push(opts)
        const label =
            index === 0 ? 'mainnet' : index === 1 ? 'testnet' : `inst${index}`
        index++
        return makeInstance(label)
    })

    const reset = () => {
        createCalls = []
        callRecords = []
        extendCalls = []
        index = 0
        create.mockClear()
    }

    return {
        create,
        reset,
        get createCalls() {
            return createCalls
        },
        get callRecords() {
            return callRecords
        },
        get extendCalls() {
            return extendCalls
        },
    }
})
vi.mock('ky', () => ({
    __esModule: true,
    default: { create: kyState.create },
}))

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

describe('api/query-client', () => {
    beforeEach(() => {
        vi.resetModules()
        kyState.reset()
    })

    test('throws when url is missing', async () => {
        const { backendFetchClient } = await import('../backend-query-client')

        await expect(
            backendFetchClient<any>({ method: 'GET' } as any),
        ).rejects.toThrow('URL is required')
    })

    test('uses mainnet client; trims leading slash; serializes params; passes json and headers; maps response', async () => {
        const { backendFetchClient } = await import('../backend-query-client')

        const data = { hello: 'world' }
        const ac = new AbortController()

        const res = await backendFetchClient<{ ok: string }>({
            url: '/api/v1/foo',
            method: 'POST',
            params: { a: [1, 2], b: 'x', c: null as any, d: undefined as any },
            data,
            signal: ac.signal,
            headers: { 'X-Test': 'T' },
        })

        // response mapping
        expect(res.status).toBe(200)
        expect(res.statusText).toBe('OK')
        expect(res.data).toEqual({ ok: 'mainnet' })

        // verify ky instance call
        expect(kyState.callRecords.length).toBe(1)
        const call = kyState.callRecords[0]
        expect(call.label).toBe('mainnet')
        expect(call.input).toBe('api/v1/foo') // trimmed
        expect(call.options.method).toBe('POST')
        expect(call.options.json).toEqual(data)
        expect(String(call.options.searchParams)).toBe('a=1&a=2&b=x')
        // header pass-through
        const headers = call.options.headers as Record<string, string>
        expect(headers['X-Test']).toBe('T')

        // ky clients created for mainnet and testnet
        expect(kyState.createCalls.length).toBe(2)
        expect(kyState.createCalls[0].prefixUrl).toBeDefined()
        expect(kyState.createCalls[1].prefixUrl).toBeDefined()
    })

    test('uses testnet client when network=testnet', async () => {
        const { backendFetchClient } = await import('../backend-query-client')
        const { useAppStore } = await import('@store/app-store')

        useAppStore.setState({ network: 'testnet' })
        await backendFetchClient<{ ok: string }>({
            url: 'bar',
            method: 'GET',
        })

        expect(kyState.callRecords.length).toBe(1)
        const call = kyState.callRecords[0]
        expect(call.label).toBe('testnet')
        expect(call.input).toBe('bar')
        expect(call.options.method).toBe('GET')
    })

    test('throws if client for current network does not exist', async () => {
        const { backendFetchClient } = await import('../backend-query-client')
        const { useAppStore } = await import('@store/app-store')

        useAppStore.setState({ network: 'devnet' as any })
        await expect(
            backendFetchClient<any>({
                url: '/missing',
                method: 'GET',
            }),
        ).rejects.toThrow('Could not get KY client')
    })

    test('setStandardHeaders sets X-API-Key header when backendAPIKey is provided', async () => {
        // Set the API key
        configMock.backendAPIKey = 'test-backend-key'

        // Clear previous imports and reset mocks
        vi.resetModules()
        kyState.reset()

        const { backendFetchClient } = await import('../backend-query-client')
        const { useAppStore } = await import('@store/app-store')

        useAppStore.setState({ network: 'testnet' })

        await backendFetchClient<{ ok: string }>({
            url: '/test',
            method: 'GET',
        })

        // Verify that ky.create was called with the correct headers
        expect(kyState.createCalls.length).toBe(2)

        // Test the setStandardHeaders function for mainnet
        const mainnetHooks = kyState.createCalls[0].hooks
        expect(mainnetHooks.beforeRequest).toBeDefined()
        expect(mainnetHooks.beforeRequest.length).toBe(2)

        // Create mock request object
        const mockRequest = {
            headers: new Map(),
            set(key: string, value: string) {
                this.headers.set(key, value)
            },
        }
        mockRequest.headers.set = vi.fn()

        // Call the first beforeRequest hook (setStandardHeaders)
        mainnetHooks.beforeRequest[0](mockRequest)

        expect(mockRequest.headers.set).toHaveBeenCalledWith(
            'Content-Type',
            'application/json',
        )
        expect(mockRequest.headers.set).toHaveBeenCalledWith(
            'X-API-Key',
            'test-backend-key',
        )

        // Reset for next test
        configMock.backendAPIKey = ''
    })

    test('setStandardHeaders does not set X-API-Key header when backendAPIKey is empty', async () => {
        // Ensure API key is empty
        configMock.backendAPIKey = ''

        // Clear previous imports and reset mocks
        vi.resetModules()
        kyState.reset()

        const { backendFetchClient } = await import('../backend-query-client')
        const { useAppStore } = await import('@store/app-store')

        useAppStore.setState({ network: 'testnet' })

        await backendFetchClient<{ ok: string }>({
            url: '/test',
            method: 'GET',
        })

        // Test the setStandardHeaders function
        const mainnetHooks = kyState.createCalls[0].hooks
        const mockRequest = {
            headers: new Map(),
            set(key: string, value: string) {
                this.headers.set(key, value)
            },
        }
        mockRequest.headers.set = vi.fn()

        // Call the first beforeRequest hook (setStandardHeaders)
        mainnetHooks.beforeRequest[0](mockRequest)

        expect(mockRequest.headers.set).toHaveBeenCalledWith(
            'Content-Type',
            'application/json',
        )
        expect(mockRequest.headers.set).not.toHaveBeenCalledWith(
            'X-API-Key',
            expect.anything(),
        )
    })

    test('updateBackendHeaders updates clients with additional headers', async () => {
        // Clear previous imports and reset mocks
        vi.resetModules()
        kyState.reset()

        const { updateBackendHeaders, backendFetchClient } = await import(
            '../backend-query-client'
        )

        // First create the initial clients
        await backendFetchClient<{ ok: string }>({
            url: '/initial',
            method: 'GET',
        })

        expect(kyState.createCalls.length).toBe(2) // mainnet and testnet

        // Now call updateBackendHeaders
        const additionalHeaders = new Map([
            ['Authorization', 'Bearer token123'],
            ['X-Custom-Header', 'custom-value'],
        ])

        updateBackendHeaders(additionalHeaders)

        // This should create new extended clients (extend method calls)
        expect(kyState.createCalls.length).toBe(2)
        expect(kyState.extendCalls.length).toBe(2)

        // Test that the extended clients have the correct hooks structure
        const extendedConfig = kyState.extendCalls[0] // First extend call
        expect(extendedConfig.hooks).toBeDefined()
        expect(extendedConfig.hooks.beforeRequest).toBeDefined()
        expect(extendedConfig.hooks.beforeRequest.length).toBe(3) // setStandardHeaders, custom headers, logRequest

        // Test the custom headers function (second hook)
        const mockRequest = {
            headers: new Map(),
            set(key: string, value: string) {
                this.headers.set(key, value)
            },
        }
        mockRequest.headers.set = vi.fn()

        // Call the second beforeRequest hook (custom headers function)
        extendedConfig.hooks.beforeRequest[1](mockRequest)

        expect(mockRequest.headers.set).toHaveBeenCalledWith(
            'Authorization',
            'Bearer token123',
        )
        expect(mockRequest.headers.set).toHaveBeenCalledWith(
            'X-Custom-Header',
            'custom-value',
        )
    })

    test('updateBackendHeaders iterates over all clients', async () => {
        // Clear previous imports and reset mocks
        vi.resetModules()
        kyState.reset()

        const { updateBackendHeaders, backendFetchClient } = await import(
            '../backend-query-client'
        )

        // First create the initial clients
        await backendFetchClient<{ ok: string }>({
            url: '/initial',
            method: 'GET',
        })

        expect(kyState.createCalls.length).toBe(2) // mainnet and testnet

        // Now call updateBackendHeaders with empty headers to test iteration
        const emptyHeaders = new Map<string, string>()

        updateBackendHeaders(emptyHeaders)

        // This should create extended clients for both networks (2 extend calls)
        expect(kyState.createCalls.length).toBe(2)
        expect(kyState.extendCalls.length).toBe(2)

        // Both extended calls should have the correct structure
        expect(kyState.createCalls[0].hooks).toBeDefined()
        expect(kyState.createCalls[1].hooks).toBeDefined()

        // Both should have the same hook structure
        expect(kyState.extendCalls[0].hooks.beforeRequest.length).toBe(3)
        expect(kyState.extendCalls[1].hooks.beforeRequest.length).toBe(3)
    })
})
