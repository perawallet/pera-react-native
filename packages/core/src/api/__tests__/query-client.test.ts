import { describe, test, expect, beforeEach, vi } from 'vitest'

// Mocks for ky and zustand store (alias: @store/app-store)
let kyCreateCalls: any[] = []
let kyCallRecords: { label: string; input: any; options: any }[] = []
let kyCreateIndex = 0

vi.mock('ky', () => {
  kyCreateCalls = []
  kyCallRecords = []
  kyCreateIndex = 0

  const makeInstance = (label: string) =>
    vi.fn(async (input: any, options: any) => {
      kyCallRecords.push({ label, input, options })
      return {
        async json() {
          return { ok: label }
        },
        status: 200,
        statusText: 'OK',
      } as any
    })

  const create = vi.fn((opts: any) => {
    kyCreateCalls.push(opts)
    const label =
      kyCreateIndex === 0 ? 'mainnet' : kyCreateIndex === 1 ? 'testnet' : `inst${kyCreateIndex}`
    kyCreateIndex++
    return makeInstance(label)
  })

  return {
    __esModule: true,
    default: { create },
  }
})

let storeState: any = { network: 'mainnet' }
vi.mock('@store/app-store', () => {
  const useAppStore: any = (selector: any) => selector(storeState)
  useAppStore.getState = () => storeState
  useAppStore.setState = (partial: any) => {
    storeState = { ...storeState, ...partial }
  }
  return { useAppStore }
})

describe('api/query-client', () => {
  beforeEach(() => {
    vi.resetModules()
    storeState = { network: 'mainnet' }
    kyCreateCalls = []
    kyCallRecords = []
    kyCreateIndex = 0
  })

  test('throws when url is missing', async () => {
    const { fetchClient } = await import('../query-client')
    await expect(fetchClient<any>({ method: 'GET' } as any)).rejects.toThrow('URL is required')
  })

  test('uses mainnet client; trims leading slash; serializes params; passes json and headers; maps response', async () => {
    const { fetchClient } = await import('../query-client')

    const data = { hello: 'world' }
    const ac = new AbortController()

    const res = await fetchClient<{ ok: string }>({
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
    expect(kyCallRecords.length).toBe(1)
    const call = kyCallRecords[0]
    expect(call.label).toBe('mainnet')
    expect(call.input).toBe('api/v1/foo') // trimmed
    expect(call.options.method).toBe('POST')
    expect(call.options.json).toEqual(data)
    expect(String(call.options.searchParams)).toBe('a=1&a=2&b=x')
    // header pass-through
    const headers = call.options.headers as Record<string, string>
    expect(headers['X-Test']).toBe('T')

    // ky clients created for mainnet and testnet
    expect(kyCreateCalls.length).toBe(2)
    expect(kyCreateCalls[0].prefixUrl).toBeDefined()
    expect(kyCreateCalls[1].prefixUrl).toBeDefined()
  })

  test('uses testnet client when network=testnet', async () => {
    const { fetchClient } = await import('../query-client')
    const { useAppStore } = await import('@store/app-store')

    useAppStore.setState({ network: 'testnet' })
    await fetchClient<{ ok: string }>({
      url: 'bar',
      method: 'GET',
    })

    expect(kyCallRecords.length).toBe(1)
    const call = kyCallRecords[0]
    expect(call.label).toBe('testnet')
    expect(call.input).toBe('bar')
    expect(call.options.method).toBe('GET')
  })

  test('throws if client for current network does not exist', async () => {
    const { fetchClient } = await import('../query-client')
    const { useAppStore } = await import('@store/app-store')

    useAppStore.setState({ network: 'devnet' as any })
    await expect(
      fetchClient<any>({
        url: '/missing',
        method: 'GET',
      }),
    ).rejects.toThrow('Could not get KY client')
  })
})