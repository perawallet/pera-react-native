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

import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { onLocalStorageKeyChanged } from '@perawallet/wallet-core-browser-runtime'
import { usePhishingListStore } from '@perawallet/wallet-core-site-safety'
import { usePhishingListRehydration } from '../usePhishingListRehydration.web'

const stopWatching = vi.hoisted(() => vi.fn())

vi.mock('@perawallet/wallet-core-browser-runtime', () => ({
    onLocalStorageKeyChanged: vi.fn(() => stopWatching),
}))

describe('usePhishingListRehydration', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it("re-reads the lists' active copy when another context writes it", () => {
        renderHook(() => usePhishingListRehydration())

        expect(onLocalStorageKeyChanged).toHaveBeenCalledWith(
            ['kv:site-safety-phishing-lists-store'],
            expect.any(Function),
        )
        const [, onChange] = vi.mocked(onLocalStorageKeyChanged).mock.calls[0]!
        onChange('kv:site-safety-phishing-lists-store')

        expect(usePhishingListStore.persist.rehydrate).toHaveBeenCalledOnce()
    })

    it('stops watching on unmount', () => {
        const { unmount } = renderHook(() => usePhishingListRehydration())

        unmount()

        expect(stopWatching).toHaveBeenCalledOnce()
    })
})
