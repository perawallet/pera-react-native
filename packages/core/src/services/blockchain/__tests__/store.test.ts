/*
 Copyright 2022-2025 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
 */

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
