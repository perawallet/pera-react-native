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
import { renderHook, act, waitFor } from '@testing-library/react'

const mockScan = vi.fn()
const mockImportSelected = vi.fn()
vi.mock('@perawallet/wallet-core-accounts', () => ({
    useRescanRekeyedAccounts: () => ({
        scan: mockScan,
        importSelected: mockImportSelected,
    }),
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
    useRoute: () => ({ params: { sourceAddress: 'SRC' } }),
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

describe('useRescanRekeyedSelectScreen', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockScan.mockReset()
        mockImportSelected.mockReset()
    })

    const renderScreen = () => renderHook(() => useRescanRekeyedSelectScreen())

    it('runs scan on mount and populates imported + candidate addresses', async () => {
        mockScan.mockResolvedValueOnce({
            importedAddresses: IMPORTED,
            notImportedAddresses: CANDIDATES,
        })

        const { result } = renderScreen()

        await waitFor(() => expect(result.current.isLoading).toBe(false))
        expect(mockScan).toHaveBeenCalledWith('SRC')
        expect(result.current.importedAddresses).toEqual(IMPORTED)
        expect(result.current.candidateAddresses).toEqual(CANDIDATES)
    })

    it('default-selects every candidate after a successful scan', async () => {
        mockScan.mockResolvedValueOnce({
            importedAddresses: [],
            notImportedAddresses: CANDIDATES,
        })

        const { result } = renderScreen()

        await waitFor(() => expect(result.current.isLoading).toBe(false))
        expect(result.current.selectedAddresses.size).toBe(CANDIDATES.length)
        CANDIDATES.forEach(address => {
            expect(result.current.selectedAddresses.has(address)).toBe(true)
        })
        expect(result.current.isAllSelected).toBe(true)
        expect(result.current.canSubmit).toBe(true)
    })

    it('sets isError when scan rejects', async () => {
        mockScan.mockRejectedValueOnce(new Error('boom'))

        const { result } = renderScreen()

        await waitFor(() => expect(result.current.isError).toBe(true))
        expect(result.current.isLoading).toBe(false)
    })

    it('toggleAddress toggles a single address in and out of the selection', async () => {
        mockScan.mockResolvedValueOnce({
            importedAddresses: [],
            notImportedAddresses: CANDIDATES,
        })

        const { result } = renderScreen()

        await waitFor(() => expect(result.current.isLoading).toBe(false))

        act(() => result.current.toggleAddress('CAND_1'))
        expect(result.current.selectedAddresses.has('CAND_1')).toBe(false)

        act(() => result.current.toggleAddress('CAND_1'))
        expect(result.current.selectedAddresses.has('CAND_1')).toBe(true)
    })

    it('toggleSelectAll clears selection when all candidates are selected', async () => {
        mockScan.mockResolvedValueOnce({
            importedAddresses: [],
            notImportedAddresses: CANDIDATES,
        })

        const { result } = renderScreen()

        await waitFor(() => expect(result.current.isLoading).toBe(false))
        expect(result.current.isAllSelected).toBe(true)

        act(() => result.current.toggleSelectAll())

        expect(result.current.selectedAddresses.size).toBe(0)
        expect(result.current.isAllSelected).toBe(false)
        expect(result.current.canSubmit).toBe(false)
    })

    it('toggleSelectAll selects every candidate when the selection is partial', async () => {
        mockScan.mockResolvedValueOnce({
            importedAddresses: [],
            notImportedAddresses: CANDIDATES,
        })

        const { result } = renderScreen()

        await waitFor(() => expect(result.current.isLoading).toBe(false))

        act(() => result.current.toggleAddress('CAND_1'))
        expect(result.current.isAllSelected).toBe(false)

        act(() => result.current.toggleSelectAll())

        expect(result.current.selectedAddresses.size).toBe(CANDIDATES.length)
        expect(result.current.isAllSelected).toBe(true)
    })

    it('handleAddSelected calls importSelected and navigates home when accounts are persisted', async () => {
        mockScan.mockResolvedValueOnce({
            importedAddresses: [],
            notImportedAddresses: CANDIDATES,
        })
        mockImportSelected.mockResolvedValueOnce(CANDIDATES.length)

        const { result } = renderScreen()

        await waitFor(() => expect(result.current.isLoading).toBe(false))

        await act(async () => {
            await result.current.handleAddSelected()
        })

        expect(mockImportSelected).toHaveBeenCalledWith(
            'SRC',
            expect.arrayContaining(CANDIDATES),
        )
        expect(mockNavigate).toHaveBeenCalledWith('TabBar', { screen: 'Home' })
        expect(mockShowError).not.toHaveBeenCalled()
        expect(mockShowToast).not.toHaveBeenCalled()
    })

    it('handleAddSelected shows a toast and does not navigate when nothing was persisted', async () => {
        mockScan.mockResolvedValueOnce({
            importedAddresses: [],
            notImportedAddresses: CANDIDATES,
        })
        // Every selected address was invalid or already in the wallet.
        mockImportSelected.mockResolvedValueOnce(0)

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

    it('handleAddSelected surfaces an error toast and does not navigate when importSelected rejects', async () => {
        mockScan.mockResolvedValueOnce({
            importedAddresses: [],
            notImportedAddresses: CANDIDATES,
        })
        const importError = new Error('import failed')
        mockImportSelected.mockRejectedValueOnce(importError)

        const { result } = renderScreen()

        await waitFor(() => expect(result.current.isLoading).toBe(false))

        await act(async () => {
            await result.current.handleAddSelected()
        })

        expect(mockShowError).toHaveBeenCalledWith(importError)
        expect(mockNavigate).not.toHaveBeenCalled()
    })

    it('handleSkip calls navigation.goBack()', async () => {
        mockScan.mockResolvedValueOnce({
            importedAddresses: [],
            notImportedAddresses: [],
        })

        const { result } = renderScreen()

        await waitFor(() => expect(result.current.isLoading).toBe(false))

        act(() => result.current.handleSkip())

        expect(mockGoBack).toHaveBeenCalledTimes(1)
    })

    it('handleRetry re-runs the scan', async () => {
        mockScan
            .mockRejectedValueOnce(new Error('first failure'))
            .mockResolvedValueOnce({
                importedAddresses: [],
                notImportedAddresses: CANDIDATES,
            })

        const { result } = renderScreen()

        await waitFor(() => expect(result.current.isError).toBe(true))

        act(() => result.current.handleRetry())

        await waitFor(() =>
            expect(result.current.candidateAddresses).toEqual(CANDIDATES),
        )
        expect(mockScan).toHaveBeenCalledTimes(2)
        expect(result.current.isError).toBe(false)
    })
})
