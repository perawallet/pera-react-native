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

import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const resolveAgeGate = vi.fn()
const applyDeclaration = vi.fn()
let storeStatus: 'adult' | 'minor' | null = null

vi.mock('@perawallet/wallet-core-age-gate', () => ({
    resolveAgeGate: (...args: unknown[]) => resolveAgeGate(...args),
    applyDeclaration: (...args: unknown[]) => applyDeclaration(...args),
    useAgeGateStore: (
        selector: (s: { status: typeof storeStatus }) => unknown,
    ) => selector({ status: storeStatus }),
}))

const mockRequest = vi.fn()
vi.mock('@modules/bottom-sheet', () => ({
    useBottomSheet: () => ({ request: mockRequest }),
}))

vi.mock('@modules/age-gate/components/AgeDeclarationContent', () => ({
    AgeDeclarationContent: () => null,
}))

import { useAgeGate } from '../useAgeGate'

describe('useAgeGate', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        storeStatus = null
    })

    it('cached adult → isAdult true; ensureChecked does not call resolveAgeGate', () => {
        storeStatus = 'adult'
        const { result } = renderHook(() => useAgeGate())
        expect(result.current.isAdult).toBe(true)
        act(() => result.current.ensureChecked())
        expect(resolveAgeGate).not.toHaveBeenCalled()
    })

    it('cached adult → isChecking false (no loading screen for a resolved user)', () => {
        storeStatus = 'adult'
        const { result } = renderHook(() => useAgeGate())
        expect(result.current.isChecking).toBe(false)
    })

    it('status null → isChecking seeded true so the gate shows loading immediately', () => {
        storeStatus = null
        const { result } = renderHook(() => useAgeGate())
        expect(result.current.isChecking).toBe(true)
    })

    it('isChecking flips back to false once the check resolves', async () => {
        resolveAgeGate.mockResolvedValue({ kind: 'resolved', status: 'minor' })
        storeStatus = null
        const { result } = renderHook(() => useAgeGate())

        act(() => result.current.ensureChecked())
        expect(result.current.isChecking).toBe(true)

        await waitFor(() => expect(result.current.isChecking).toBe(false))
    })

    it('cached minor → ensureChecked does not call resolveAgeGate', () => {
        storeStatus = 'minor'
        const { result } = renderHook(() => useAgeGate())
        act(() => result.current.ensureChecked())
        expect(resolveAgeGate).not.toHaveBeenCalled()
    })

    it('status null/unknown → ensureChecked calls resolveAgeGate with {}', async () => {
        resolveAgeGate.mockResolvedValue({ kind: 'resolved', status: 'adult' })
        const { result } = renderHook(() => useAgeGate())
        expect(result.current.status).toBe('unknown')
        act(() => result.current.ensureChecked())
        await waitFor(() => expect(resolveAgeGate).toHaveBeenCalledWith({}))
    })

    it('resolve returns needs-declaration, request resolves true → applyDeclaration called with true', async () => {
        resolveAgeGate.mockResolvedValue({ kind: 'needs-declaration' })
        mockRequest.mockResolvedValue(true)
        const { result } = renderHook(() => useAgeGate())
        act(() => result.current.ensureChecked())
        await waitFor(() => expect(applyDeclaration).toHaveBeenCalledWith(true))
    })

    it('resolve returns needs-declaration, request resolves undefined → applyDeclaration called with false', async () => {
        resolveAgeGate.mockResolvedValue({ kind: 'needs-declaration' })
        mockRequest.mockResolvedValue(undefined)
        const { result } = renderHook(() => useAgeGate())
        act(() => result.current.ensureChecked())
        await waitFor(() =>
            expect(applyDeclaration).toHaveBeenCalledWith(false),
        )
    })

    it('retry calls resolveAgeGate with { force: true }', async () => {
        resolveAgeGate.mockResolvedValue({ kind: 'resolved', status: 'minor' })
        const { result } = renderHook(() => useAgeGate())
        act(() => result.current.retry())
        await waitFor(() =>
            expect(resolveAgeGate).toHaveBeenCalledWith({ force: true }),
        )
    })
})
