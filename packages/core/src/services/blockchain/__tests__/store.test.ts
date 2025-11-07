import { createBlockchainSlice, type BlockchainSlice } from '../store'
import { Networks, type SignRequest } from '../types'

describe('services/blockchain/store', () => {
    test('defaults to mainnet and setNetwork updates', () => {
        let state: BlockchainSlice
        const set = (partial: Partial<BlockchainSlice>) => {
            state = {
                ...(state as BlockchainSlice),
                ...(partial as BlockchainSlice),
            }
        }
        const get = () => state

        state = createBlockchainSlice(set as any, get as any, {} as any)

        expect(state.network).toBe(Networks.mainnet)
        state.setNetwork(Networks.testnet)
        expect(state.network).toBe(Networks.testnet)
    })

    test('addSignRequest adds new request and returns true', () => {
        let state: BlockchainSlice
        const set = (partial: Partial<BlockchainSlice>) => {
            state = {
                ...(state as BlockchainSlice),
                ...(partial as BlockchainSlice),
            }
        }
        const get = () => state

        state = createBlockchainSlice(set as any, get as any, {} as any)

        const request: SignRequest = { txs: [[]] }
        const result = state.addSignRequest(request)

        expect(result).toBe(true)
        expect(state.pendingSignRequests).toHaveLength(1)
        expect(state.pendingSignRequests[0].id).toBeDefined()
        expect(state.pendingSignRequests[0].txs).toEqual(request.txs)
    })

    test('addSignRequest does not add duplicate request and returns false', () => {
        let state: BlockchainSlice
        const set = (partial: Partial<BlockchainSlice>) => {
            state = {
                ...(state as BlockchainSlice),
                ...(partial as BlockchainSlice),
            }
        }
        const get = () => state

        state = createBlockchainSlice(set as any, get as any, {} as any)

        const request: SignRequest = { id: 'test-id', txs: [[]] }
        state.addSignRequest(request)
        const result = state.addSignRequest(request)

        expect(result).toBe(false)
        expect(state.pendingSignRequests).toHaveLength(1)
    })

    test('removeSignRequest removes existing request and returns true', () => {
        let state: BlockchainSlice
        const set = (partial: Partial<BlockchainSlice>) => {
            state = {
                ...(state as BlockchainSlice),
                ...(partial as BlockchainSlice),
            }
        }
        const get = () => state

        state = createBlockchainSlice(set as any, get as any, {} as any)

        const request: SignRequest = { id: 'test-id', txs: [[]] }
        state.addSignRequest(request)
        const result = state.removeSignRequest(request)

        expect(result).toBe(true)
        expect(state.pendingSignRequests).toHaveLength(0)
    })

    test('removeSignRequest does not remove non-existing request and returns false', () => {
        let state: BlockchainSlice
        const set = (partial: Partial<BlockchainSlice>) => {
            state = {
                ...(state as BlockchainSlice),
                ...(partial as BlockchainSlice),
            }
        }
        const get = () => state

        state = createBlockchainSlice(set as any, get as any, {} as any)

        const request: SignRequest = { id: 'test-id', txs: [[]] }
        const result = state.removeSignRequest(request)

        expect(result).toBe(false)
        expect(state.pendingSignRequests).toHaveLength(0)
    })

    test('pendingSignRequests state updates correctly', () => {
        let state: BlockchainSlice
        const set = (partial: Partial<BlockchainSlice>) => {
            state = {
                ...(state as BlockchainSlice),
                ...(partial as BlockchainSlice),
            }
        }
        const get = () => state

        state = createBlockchainSlice(set as any, get as any, {} as any)

        expect(state.pendingSignRequests).toEqual([])

        const request1: SignRequest = { txs: [[]] }
        const request2: SignRequest = { txs: [[]] }

        state.addSignRequest(request1)
        expect(state.pendingSignRequests).toHaveLength(1)

        state.addSignRequest(request2)
        expect(state.pendingSignRequests).toHaveLength(2)

        state.removeSignRequest(state.pendingSignRequests[0])
        expect(state.pendingSignRequests).toHaveLength(1)
    })
})
