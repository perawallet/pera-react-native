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
import { act, renderHook } from '@testing-library/react'
import {
    useAccountDrawerRequest,
    useAccountDrawerRequestStore,
    useFirstAccountRequest,
} from '../useAccountDrawerRequest'

describe('useAccountDrawerRequest', () => {
    beforeEach(() => {
        useAccountDrawerRequestStore.setState({
            isRequested: false,
            isFirstAccountPending: false,
        })
    })

    // A cold start delivers the link before the tab shell mounts the drawer.
    it('opens for a request made before mount, once', () => {
        useAccountDrawerRequestStore.getState().requestAccountDrawer()
        const open = vi.fn()

        const { rerender } = renderHook(() => useAccountDrawerRequest(open))
        rerender()

        expect(open).toHaveBeenCalledTimes(1)
        expect(useAccountDrawerRequestStore.getState().isRequested).toBe(false)
    })

    it('opens for a request made while mounted', () => {
        const open = vi.fn()
        renderHook(() => useAccountDrawerRequest(open))
        expect(open).not.toHaveBeenCalled()

        act(() =>
            useAccountDrawerRequestStore.getState().requestAccountDrawer(),
        )

        expect(open).toHaveBeenCalledTimes(1)
    })
})

describe('useFirstAccountRequest', () => {
    beforeEach(() => {
        useAccountDrawerRequestStore.setState({
            isRequested: false,
            isFirstAccountPending: false,
        })
    })

    // Accounts can still be loading when the drawer opens.
    it('selects the first account once the list has one, then stops', () => {
        useAccountDrawerRequestStore.getState().requestAccountDrawer()
        const select = vi.fn()
        const { rerender } = renderHook(
            ({ first }: { first: string | undefined }) =>
                useFirstAccountRequest(first, select),
            { initialProps: { first: undefined as string | undefined } },
        )
        expect(select).not.toHaveBeenCalled()

        rerender({ first: 'first-account' })
        rerender({ first: 'another-account' })

        expect(select).toHaveBeenCalledTimes(1)
        expect(select).toHaveBeenCalledWith('first-account')
    })

    it('leaves the selection alone without a request', () => {
        const select = vi.fn()

        renderHook(() => useFirstAccountRequest('first-account', select))

        expect(select).not.toHaveBeenCalled()
    })
})
