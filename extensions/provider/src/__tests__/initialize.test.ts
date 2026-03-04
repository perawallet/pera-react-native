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

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { clearDataStores } from '../initialize'
import { clearAllStores } from '@perawallet/wallet-core-shared'

vi.mock('@perawallet/wallet-core-shared', () => ({
    clearAllStores: vi.fn(),
}))

describe('clearDataStores', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('delegates to clearAllStores from the store registry', () => {
        clearDataStores()

        expect(clearAllStores).toHaveBeenCalledTimes(1)
    })
})
