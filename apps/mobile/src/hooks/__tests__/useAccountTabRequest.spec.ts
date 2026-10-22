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
import { renderHook } from '@testing-library/react'
import {
    useAccountTabRequest,
    useAccountTabRequestStore,
} from '../useAccountTabRequest'

const WITH_HISTORY = ['Overview', 'Nfts', 'History']

describe('useAccountTabRequest', () => {
    beforeEach(() => {
        useAccountTabRequestStore.setState({ requestedTab: null })
    })

    it('selects the requested tab by its index, once', () => {
        useAccountTabRequestStore.getState().requestAccountTab('History')
        const select = vi.fn()

        const { rerender } = renderHook(() =>
            useAccountTabRequest(WITH_HISTORY, select),
        )
        rerender()

        expect(select).toHaveBeenCalledTimes(1)
        expect(select).toHaveBeenCalledWith(2)
    })

    // A later account must not land on History unasked.
    it('drops a request the account has no tab for', () => {
        useAccountTabRequestStore.getState().requestAccountTab('History')
        const select = vi.fn()

        renderHook(() => useAccountTabRequest(['Overview'], select))

        expect(select).not.toHaveBeenCalled()
        expect(useAccountTabRequestStore.getState().requestedTab).toBeNull()
    })

    it('does nothing without a request', () => {
        const select = vi.fn()

        renderHook(() => useAccountTabRequest(WITH_HISTORY, select))

        expect(select).not.toHaveBeenCalled()
    })
})
