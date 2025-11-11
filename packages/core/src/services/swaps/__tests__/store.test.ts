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

import {
    createSwapsSlice,
    partializeSwapsSlice,
    type SwapsSlice,
} from '../store'

describe('services/swaps/store', () => {
    test('defaults to ALGO and USDC and updates correctly', () => {
        let state: SwapsSlice

        const set = (partial: Partial<SwapsSlice>) => {
            state = {
                ...(state as SwapsSlice),
                ...(partial as SwapsSlice),
            }
        }

        // initialize slice
        state = createSwapsSlice(set as any, {} as any, {} as any)

        // defaults
        expect(state.fromAsset).toBe('0')
        expect(state.toAsset).toBe('1001')

        // update fromAsset
        state.setFromAsset('123')
        expect(state.fromAsset).toBe('123')

        // update toAsset
        state.setToAsset('456')
        expect(state.toAsset).toBe('456')
    })

    test('partializeSwapsSlice returns only the persisted subset', () => {
        const state: SwapsSlice = {
            fromAsset: '100',
            toAsset: '200',
            setFromAsset: () => {},
            setToAsset: () => {},
        }

        const partial = partializeSwapsSlice(state)
        expect(partial).toEqual({
            fromAsset: '100',
            toAsset: '200',
        })

        // ensure we didn't accidentally include functions
        expect((partial as any).setFromAsset).toBeUndefined()
        expect((partial as any).setToAsset).toBeUndefined()
    })
})
