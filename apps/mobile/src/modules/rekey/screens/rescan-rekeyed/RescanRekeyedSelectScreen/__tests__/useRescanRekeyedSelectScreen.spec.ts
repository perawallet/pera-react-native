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

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'

const { mockScanAll, mockImportFromSweep, routeState, signingAccountsState } =
    vi.hoisted(() => ({
        mockScanAll: vi.fn(),
        mockImportFromSweep: vi.fn(),
        routeState: {
            params: { sourceAddress: 'SRC' } as { sourceAddress?: string },
        },
        signingAccountsState: {
            current: [{ address: 'KEY_1' }, { address: 'KEY_2' }] as Array<{
                address: string
            }>,
        },
    }))

vi.mock('@perawallet/wallet-core-accounts', () => ({
    useRescanRekeyedAccounts: () => ({
        scanAll: mockScanAll,
        importFromSweep: mockImportFromSweep,
    }),
    useSigningAccounts: () => signingAccountsState.current,
}))

const mockNavigate = vi.fn()
const mockGoBack = vi.fn()
vi.mock('@hooks/useAppNavigation', () => ({
    useAppNavigation: () => ({
        navigate: mockNavigate,
        goBack: mockGoBack,
    }),
}))

vi.mock('@react-navigation/native', () => ({
    useRoute: () => ({ params: routeState.params }),
}))

const mockShowError = vi.fn()
vi.mock('@hooks/useErrorToast', () => ({
    useErrorToast: () => ({ showError: mockShowError }),
}))

const mockShowToast = vi.fn()
vi.mock('@hooks/useToast', () => ({
    useToast: () => ({ showToast: mockShowToast }),
}))

vi.mock('@hooks/useLanguage', () => ({
    useLanguage: () => ({ t: (key: string) => key }),
}))

import { useRescanRekeyedSelectScreen } from '../useRescanRekeyedSelectScreen'

const IMPORTED = ['IMP_1', 'IMP_2']
const CANDIDATES = ['CAND_1', 'CAND_2', 'CAND_3']

const sweepResult = (
    overrides: Partial<{
        importedAddresses: string[]
        candidates: Array<{ address: string; sourceAddress: string }>
        failedSources: string[]
    }> = {},
) => ({
    importedAddresses: [],
    candidates: CANDIDATES.map(address => ({ address, sourceAddress: 'SRC' })),
    failedSources: [],
    ...overrides,
})

describe('useRescanRekeyedSelectScreen', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockScanAll.mockReset()
        mockImportFromSweep.mockReset()
        routeState.params = { sourceAddress: 'SRC' }
        signingAccountsState.current = [
            { address: 'KEY_1' },
            { address: 'KEY_2' },
        ]
    })

    const renderScreen = () => renderHook(() => useRescanRekeyedSelectScreen())

    it('runs a single-key scan on mount and populates imported + candidate addresses', async () => {
        mockScanAll.mockResolvedValueOnce(
            sweepResult({ importedAddresses: IMPORTED }),
        )

        const { result } = renderScreen()

        await waitFor(() => expect(result.current.isLoading).toBe(false))
        expect(mockScanAll).toHaveBeenCalledWith(['SRC'], expect.anything())
        expect(result.current.importedAddresses).toEqual(IMPORTED)
        expect(result.current.candidateAddresses).toEqual(CANDIDATES)
        expect(result.current.isSweep).toBe(false)
    })

    it('sweeps every signable key when the route names no source address', async () => {
        routeState.params = {}
        mockScanAll.mockResolvedValueOnce(sweepResult())

        const { result } = renderScreen()

        await waitFor(() => expect(result.current.isLoading).toBe(false))
        expect(mockScanAll).toHaveBeenCalledWith(
            ['KEY_1', 'KEY_2'],
            expect.anything(),
        )
        expect(result.current.isSweep).toBe(true)
    })

    it('exposes scan progress while the sweep runs', async () => {
        routeState.params = {}
        mockScanAll.mockImplementationOnce(
            async (
                _sources: string[],
                options: {
                    onProgress?: (scanned: number, total: number) => void
                },
            ) => {
                options.onProgress?.(1, 2)
                options.onProgress?.(2, 2)
                return sweepResult()
            },
        )

        const { result } = renderScreen()

        await waitFor(() => expect(result.current.isLoading).toBe(false))
        expect(result.current.scanProgress).toEqual({ scanned: 2, total: 2 })
    })

    it('surfaces a partial failure without entering the error state', async () => {
        routeState.params = {}
        mockScanAll.mockResolvedValueOnce(
            sweepResult({ failedSources: ['KEY_2'] }),
        )

        const { result } = renderScreen()

        await waitFor(() => expect(result.current.isLoading).toBe(false))
        expect(result.current.failedSourceCount).toBe(1)
        expect(result.current.isError).toBe(false)
        expect(result.current.candidateAddresses).toEqual(CANDIDATES)
    })

    it('sets isError when every key scan failed', async () => {
        routeState.params = {}
        mockScanAll.mockResolvedValueOnce(
            sweepResult({ candidates: [], failedSources: ['KEY_1', 'KEY_2'] }),
        )

        const { result } = renderScreen()

        await waitFor(() => expect(result.current.isError).toBe(true))
        expect(result.current.isLoading).toBe(false)
    })

    it('sets isError when the sweep itself rejects', async () => {
        mockScanAll.mockRejectedValueOnce(new Error('boom'))

        const { result } = renderScreen()

        await waitFor(() => expect(result.current.isError).toBe(true))
        expect(result.current.isLoading).toBe(false)
    })

    it('default-selects every candidate after a successful scan', async () => {
        mockScanAll.mockResolvedValueOnce(sweepResult())

        const { result } = renderScreen()

        await waitFor(() => expect(result.current.isLoading).toBe(false))
        expect(result.current.selectedAddresses.size).toBe(CANDIDATES.length)
        CANDIDATES.forEach(address => {
            expect(result.current.selectedAddresses.has(address)).toBe(true)
        })
        expect(result.current.isAllSelected).toBe(true)
        expect(result.current.canSubmit).toBe(true)
    })

    it('toggleAddress toggles a single address in and out of the selection', async () => {
        mockScanAll.mockResolvedValueOnce(sweepResult())

        const { result } = renderScreen()

        await waitFor(() => expect(result.current.isLoading).toBe(false))

        act(() => result.current.toggleAddress('CAND_1'))
        expect(result.current.selectedAddresses.has('CAND_1')).toBe(false)

        act(() => result.current.toggleAddress('CAND_1'))
        expect(result.current.selectedAddresses.has('CAND_1')).toBe(true)
    })

    it('toggleSelectAll clears selection when all candidates are selected', async () => {
        mockScanAll.mockResolvedValueOnce(sweepResult())

        const { result } = renderScreen()

        await waitFor(() => expect(result.current.isLoading).toBe(false))
        expect(result.current.isAllSelected).toBe(true)

        act(() => result.current.toggleSelectAll())

        expect(result.current.selectedAddresses.size).toBe(0)
        expect(result.current.isAllSelected).toBe(false)
        expect(result.current.canSubmit).toBe(false)
    })

    it('toggleSelectAll selects every candidate when the selection is partial', async () => {
        mockScanAll.mockResolvedValueOnce(sweepResult())

        const { result } = renderScreen()

        await waitFor(() => expect(result.current.isLoading).toBe(false))

        act(() => result.current.toggleAddress('CAND_1'))
        expect(result.current.isAllSelected).toBe(false)

        act(() => result.current.toggleSelectAll())

        expect(result.current.selectedAddresses.size).toBe(CANDIDATES.length)
        expect(result.current.isAllSelected).toBe(true)
    })

    it('handleAddSelected imports the selected candidates with their source keys and navigates home', async () => {
        routeState.params = {}
        mockScanAll.mockResolvedValueOnce(
            sweepResult({
                candidates: [
                    { address: 'CAND_1', sourceAddress: 'KEY_1' },
                    { address: 'CAND_2', sourceAddress: 'KEY_2' },
                ],
            }),
        )
        mockImportFromSweep.mockResolvedValueOnce(2)

        const { result } = renderScreen()

        await waitFor(() => expect(result.current.isLoading).toBe(false))

        await act(async () => {
            await result.current.handleAddSelected()
        })

        expect(mockImportFromSweep).toHaveBeenCalledWith([
            { address: 'CAND_1', sourceAddress: 'KEY_1' },
            { address: 'CAND_2', sourceAddress: 'KEY_2' },
        ])
        expect(mockNavigate).toHaveBeenCalledWith('TabBar', { screen: 'Home' })
        expect(mockShowError).not.toHaveBeenCalled()
        expect(mockShowToast).not.toHaveBeenCalled()
    })

    it('handleAddSelected shows a toast and does not navigate when nothing was persisted', async () => {
        mockScanAll.mockResolvedValueOnce(sweepResult())
        // Every selected address was invalid or already in the wallet.
        mockImportFromSweep.mockResolvedValueOnce(0)

        const { result } = renderScreen()

        await waitFor(() => expect(result.current.isLoading).toBe(false))

        await act(async () => {
            await result.current.handleAddSelected()
        })

        expect(mockShowToast).toHaveBeenCalledWith(
            expect.objectContaining({ type: 'error' }),
        )
        expect(mockNavigate).not.toHaveBeenCalled()
    })

    it('handleAddSelected surfaces an error toast and does not navigate when the import rejects', async () => {
        mockScanAll.mockResolvedValueOnce(sweepResult())
        const importError = new Error('import failed')
        mockImportFromSweep.mockRejectedValueOnce(importError)

        const { result } = renderScreen()

        await waitFor(() => expect(result.current.isLoading).toBe(false))

        await act(async () => {
            await result.current.handleAddSelected()
        })

        expect(mockShowError).toHaveBeenCalledWith(importError)
        expect(mockNavigate).not.toHaveBeenCalled()
    })

    it('handleSkip calls navigation.goBack()', async () => {
        mockScanAll.mockResolvedValueOnce(sweepResult({ candidates: [] }))

        const { result } = renderScreen()

        await waitFor(() => expect(result.current.isLoading).toBe(false))

        act(() => result.current.handleSkip())

        expect(mockGoBack).toHaveBeenCalledTimes(1)
    })
})
