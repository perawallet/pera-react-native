import { describe, test, expect, beforeEach, vi } from 'vitest'

// Mock the config
const configMock = vi.hoisted(() => ({
    algodApiKey: '',
    mainnetAlgodUrl: 'https://mainnet.algod.example.com',
    testnetAlgodUrl: 'https://testnet.algod.example.com',
    debugEnabled: false,
}))
vi.mock('@perawallet/config', () => ({
    config: configMock,
}))

vi.mock('../../services/blockchain', () => ({
    Networks: {
        mainnet: 'mainnet',
        testnet: 'testnet',
    },
}))

// Mocks for ky and zustand store (alias: @store/app-store)

const kyState = vi.hoisted(() => {
    let createCalls: any[] = []
    let callRecords: { label: string; input: any; options: any }[] = []
    let index = 0

    const makeInstance = (label: string) =>
        vi.fn(async (input: any, options: any) => {
            callRecords.push({ label, input, options })
            return {
                async json() {
                    return { ok: label }
                },
                status: 200,
                statusText: 'OK',
            } as any
        })

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
        const { algodFetchClient } = await import('../algod-query-client')

        await expect(
            algodFetchClient<any>({ method: 'GET' } as any),
        ).rejects.toThrow('URL is required')
    })

    test('uses mainnet client; trims leading slash; serializes params; passes json and headers; maps response', async () => {
        const { algodFetchClient } = await import('../algod-query-client')

        const data = { hello: 'world' }
        const ac = new AbortController()

        const res = await algodFetchClient<{ ok: string }>({
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
        expect(
            new URLSearchParams(call.options.searchParams as any).toString(),
        ).toBe('a=1%2C2&b=x&c=null&d=undefined')
        // header pass-through
        const headers = call.options.headers as Record<string, string>
        expect(headers['X-Test']).toBe('T')

        // ky clients created for mainnet and testnet
        expect(kyState.createCalls.length).toBe(2)
        expect(kyState.createCalls[0].prefixUrl).toBeDefined()
        expect(kyState.createCalls[1].prefixUrl).toBeDefined()
    })

    test('uses testnet client when network=testnet', async () => {
        const { algodFetchClient } = await import('../algod-query-client')
        const { useAppStore } = await import('@store/app-store')

        useAppStore.setState({ network: 'testnet' })
        await algodFetchClient<{ ok: string }>({
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
        const { algodFetchClient } = await import('../algod-query-client')
        const { useAppStore } = await import('@store/app-store')

        useAppStore.setState({ network: 'devnet' as any })
        await expect(
            algodFetchClient<any>({
                url: '/missing',
                method: 'GET',
            }),
        ).rejects.toThrow('Could not get KY client')
    })

    test('sets X-Algo-API-Token header when algodApiKey is provided', async () => {
        // Set the API key
        configMock.algodApiKey = 'test-api-key'

        // Clear previous imports and reset mocks
        vi.resetModules()
        kyState.reset()

        const { algodFetchClient } = await import('../algod-query-client')
        const { useAppStore } = await import('@store/app-store')

        useAppStore.setState({ network: 'testnet' })

        await algodFetchClient<{ ok: string }>({
            url: '/test',
            method: 'GET',
        })

        // Verify that ky.create was called with the correct headers
        expect(kyState.createCalls.length).toBe(2)

        // Check mainnet client creation (first call)
        const mainnetHooks = kyState.createCalls[0].hooks
        expect(mainnetHooks.beforeRequest).toBeDefined()
        expect(mainnetHooks.beforeRequest.length).toBe(2)

        // Test the header setting function for mainnet
        const mockRequest = {
            headers: new Map(),
            set(key: string, value: string) {
                this.headers.set(key, value)
            },
        }
        mockRequest.headers.set = vi.fn()

        // Call the first beforeRequest hook (header setting)
        mainnetHooks.beforeRequest[0](mockRequest)

        expect(mockRequest.headers.set).toHaveBeenCalledWith(
            'Content-Type',
            'application/json',
        )
        expect(mockRequest.headers.set).toHaveBeenCalledWith(
            'X-Algo-API-Token',
            'test-api-key',
        )

        // Check testnet client creation (second call)
        const testnetHooks = kyState.createCalls[1].hooks
        expect(testnetHooks.beforeRequest).toBeDefined()
        expect(testnetHooks.beforeRequest.length).toBe(2)

        // Test the header setting function for testnet
        const mockRequest2 = {
            headers: new Map(),
            set(key: string, value: string) {
                this.headers.set(key, value)
            },
        }
        mockRequest2.headers.set = vi.fn()

        // Call the first beforeRequest hook (header setting)
        testnetHooks.beforeRequest[0](mockRequest2)

        expect(mockRequest2.headers.set).toHaveBeenCalledWith(
            'Content-Type',
            'application/json',
        )
        expect(mockRequest2.headers.set).toHaveBeenCalledWith(
            'X-Algo-API-Token',
            'test-api-key',
        )

        // Reset for next test
        configMock.algodApiKey = ''
    })

    test('does not set X-Algo-API-Token header when algodApiKey is empty', async () => {
        // Ensure API key is empty
        configMock.algodApiKey = ''

        // Clear previous imports and reset mocks
        vi.resetModules()
        kyState.reset()

        const { algodFetchClient } = await import('../algod-query-client')
        const { useAppStore } = await import('@store/app-store')

        useAppStore.setState({ network: 'testnet' })

        await algodFetchClient<{ ok: string }>({
            url: '/test',
            method: 'GET',
        })

        // Verify that ky.create was called
        expect(kyState.createCalls.length).toBe(2)

        // Test the header setting function for mainnet
        const mainnetHooks = kyState.createCalls[0].hooks
        const mockRequest = {
            headers: new Map(),
            set(key: string, value: string) {
                this.headers.set(key, value)
            },
        }
        mockRequest.headers.set = vi.fn()

        // Call the first beforeRequest hook (header setting)
        mainnetHooks.beforeRequest[0](mockRequest)

        expect(mockRequest.headers.set).toHaveBeenCalledWith(
            'Content-Type',
            'application/json',
        )
        expect(mockRequest.headers.set).not.toHaveBeenCalledWith(
            'X-Algo-API-Token',
            expect.anything(),
        )

        // Test the header setting function for testnet
        const testnetHooks = kyState.createCalls[1].hooks
        const mockRequest2 = {
            headers: new Map(),
            set(key: string, value: string) {
                this.headers.set(key, value)
            },
        }
        mockRequest2.headers.set = vi.fn()

        // Call the first beforeRequest hook (header setting)
        testnetHooks.beforeRequest[0](mockRequest2)

        expect(mockRequest2.headers.set).toHaveBeenCalledWith(
            'Content-Type',
            'application/json',
        )
        expect(mockRequest2.headers.set).not.toHaveBeenCalledWith(
            'X-Algo-API-Token',
            expect.anything(),
        )
    })
})
