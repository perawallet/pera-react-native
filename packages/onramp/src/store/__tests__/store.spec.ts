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

import { describe, it, expect, beforeEach } from 'vitest'
import { useOnrampStore } from '../store'

describe('useOnrampStore', () => {
    beforeEach(() => {
        useOnrampStore.getState().resetState()
    })

    it('setSelectedSourceTokenId updates selectedSourceTokenId', () => {
        useOnrampStore.getState().setSelectedSourceTokenId('USD')
        expect(useOnrampStore.getState().selectedSourceTokenId).toBe('USD')
    })

    it('setSelectedDestinationTokenId updates selectedDestinationTokenId', () => {
        useOnrampStore.getState().setSelectedDestinationTokenId('ALGO')
        expect(useOnrampStore.getState().selectedDestinationTokenId).toBe(
            'ALGO',
        )
    })

    it('resetState clears both token ids and senderAddress', () => {
        useOnrampStore.getState().setSelectedSourceTokenId('USD')
        useOnrampStore.getState().setSelectedDestinationTokenId('ALGO')
        useOnrampStore.getState().setSenderAddress('ADDR')
        useOnrampStore.getState().resetState()
        const s = useOnrampStore.getState()
        expect(s.selectedSourceTokenId).toBeNull()
        expect(s.selectedDestinationTokenId).toBeNull()
        expect(s.senderAddress).toBe('')
    })
})
