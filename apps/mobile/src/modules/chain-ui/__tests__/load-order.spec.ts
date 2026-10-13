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

import { describe, expect, it, vi } from 'vitest'

const loaded = vi.hoisted(() => ({ chainUi: false }))

vi.mock('@modules/chain-ui', () => {
    loaded.chainUi = true
    return { chainUiFor: vi.fn() }
})

// The registry builds its map at module load. If the assets barrel ever reached
// it, Algorand's transaction bodies (which import AssetTitle from that barrel)
// could still be initialising and its entry would come out undefined.
describe('chain-UI registry load order', () => {
    it('is not loaded by the assets barrel or by Algorand chain UI', async () => {
        await import('@modules/assets')
        await import('@modules/algorand/chain-ui')

        expect(loaded.chainUi).toBe(false)
    })
})
