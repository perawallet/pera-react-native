import { describe, it, expect, vi, beforeEach } from 'vitest'
import { updateManualBackendHeaders } from '../query-client'

// Mock dependencies
vi.mock('../../store/app-store', () => ({
    useAppStore: {
        getState: vi.fn(() => ({ network: 'testnet' })),
    },
}))

vi.mock('@perawallet/config', () => ({
    config: {
        debugEnabled: false,
        backendAPIKey: 'test-key',
        algodApiKey: 'algod-key',
        indexerApiKey: 'indexer-key',
        mainnetBackendUrl: 'https://mainnet.backend.test',
        testnetBackendUrl: 'https://testnet.backend.test',
        mainnetAlgodUrl: 'https://mainnet.algod.test',
        testnetAlgodUrl: 'https://testnet.algod.test',
        mainnetIndexerUrl: 'https://mainnet.indexer.test',
        testnetIndexerUrl: 'https://testnet.indexer.test',
    },
}))

describe('data/query-client', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    describe('updateManualBackendHeaders', () => {
        it('updates headers for all network clients', () => {
            const headers = new Map<string, string>([
                ['X-Custom-Header', 'custom-value'],
                ['X-Another-Header', 'another-value'],
            ])

            // This function extends the clients with new headers
            // We're testing that it doesn't throw and can be called
            expect(() => updateManualBackendHeaders(headers)).not.toThrow()
        })

        it('handles empty headers map', () => {
            const headers = new Map<string, string>()
            expect(() => updateManualBackendHeaders(headers)).not.toThrow()
        })

        it('handles multiple header updates', () => {
            const headers1 = new Map<string, string>([['X-Header-1', 'value-1']])
            const headers2 = new Map<string, string>([['X-Header-2', 'value-2']])

            expect(() => {
                updateManualBackendHeaders(headers1)
                updateManualBackendHeaders(headers2)
            }).not.toThrow()
        })
    })
})
