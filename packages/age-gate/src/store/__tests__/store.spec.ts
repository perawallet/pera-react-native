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

import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@perawallet/wallet-extension-provider', () => ({
    getProvider: () => ({
        keyValueStorage: {
            getItem: vi.fn().mockReturnValue(null),
            setItem: vi.fn(),
            removeItem: vi.fn(),
        },
    }),
}))

import { useAgeGateStore } from '../store'

describe('useAgeGateStore', () => {
    beforeEach(() => {
        useAgeGateStore.getState().resetState()
    })

    it('starts with a null decision', () => {
        expect(useAgeGateStore.getState().status).toBeNull()
        expect(useAgeGateStore.getState().source).toBeNull()
    })

    it('stores a decision', () => {
        useAgeGateStore.getState().setDecision('adult', 'platform')
        expect(useAgeGateStore.getState().status).toBe('adult')
        expect(useAgeGateStore.getState().source).toBe('platform')
    })

    it('resetState clears the decision', () => {
        useAgeGateStore.getState().setDecision('minor', 'self-declared')
        useAgeGateStore.getState().resetState()
        expect(useAgeGateStore.getState().status).toBeNull()
        expect(useAgeGateStore.getState().source).toBeNull()
    })
})
