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

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'

const {
    mockRequestByType,
    mockOptIn,
    mockShowToast,
    mockShowError,
    UserRejectedSigningError,
} = vi.hoisted(() => {
    class UserRejectedSigningError extends Error {}
    return {
        mockRequestByType: vi.fn(),
        mockOptIn: vi.fn(),
        mockShowToast: vi.fn(),
        mockShowError: vi.fn(),
        UserRejectedSigningError,
    }
})

vi.mock('@modules/bottom-sheet', () => ({
    useBottomSheetStore: () => ({ requestByType: mockRequestByType }),
}))
vi.mock('@perawallet/wallet-core-transactions', () => ({
    useAssetOptInMutation: () => ({ optIn: mockOptIn }),
}))
vi.mock('@perawallet/wallet-core-signing', () => ({
    UserRejectedSigningError,
}))
vi.mock('@hooks/useToast', () => ({
    useToast: () => ({ showToast: mockShowToast }),
}))
vi.mock('@hooks/useErrorToast', () => ({
    useErrorToast: () => ({ showError: mockShowError }),
}))
vi.mock('@hooks/useLanguage', () => ({
    useLanguage: () => ({ t: (key: string) => key }),
}))

import { useAssetOptInDeeplink } from '../useAssetOptInDeeplink'

const ASSET_ID = '31566704'
const LINK_ADDRESS = 'LINK_ADDRESS'
const PICKED_ADDRESS = 'PICKED_ADDRESS'

describe('useAssetOptInDeeplink', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockOptIn.mockResolvedValue({ txIds: ['TX1'] })
    })

    it('uses the link address, skips the picker, confirms, and opts in', async () => {
        mockRequestByType.mockResolvedValueOnce('confirm') // confirmation sheet

        const { result } = renderHook(() => useAssetOptInDeeplink())

        await act(async () => {
            await result.current({ assetId: ASSET_ID, address: LINK_ADDRESS })
        })

        // Only the confirmation sheet — no account-selection sheet.
        expect(mockRequestByType).toHaveBeenCalledTimes(1)
        expect(mockRequestByType).toHaveBeenCalledWith(
            'asset-opt-in',
            { assetId: ASSET_ID, accountAddress: LINK_ADDRESS },
            expect.anything(),
        )
        expect(mockOptIn).toHaveBeenCalledWith({
            sender: LINK_ADDRESS,
            assetId: BigInt(ASSET_ID),
        })
        expect(mockShowToast).toHaveBeenCalledWith(
            expect.objectContaining({ type: 'success' }),
        )
    })

    it('prompts for an account when the link carries no address, then opts in with the chosen account', async () => {
        mockRequestByType
            .mockResolvedValueOnce(PICKED_ADDRESS) // account selection
            .mockResolvedValueOnce('confirm') // confirmation

        const { result } = renderHook(() => useAssetOptInDeeplink())

        await act(async () => {
            await result.current({ assetId: ASSET_ID })
        })

        expect(mockRequestByType).toHaveBeenNthCalledWith(
            1,
            'asset-opt-in-account-selection',
            {},
            expect.anything(),
        )
        expect(mockOptIn).toHaveBeenCalledWith({
            sender: PICKED_ADDRESS,
            assetId: BigInt(ASSET_ID),
        })
    })

    it('aborts without opting in when the account picker is dismissed', async () => {
        mockRequestByType.mockResolvedValueOnce(undefined) // dismissed picker

        const { result } = renderHook(() => useAssetOptInDeeplink())

        await act(async () => {
            await result.current({ assetId: ASSET_ID })
        })

        expect(mockRequestByType).toHaveBeenCalledTimes(1)
        expect(mockOptIn).not.toHaveBeenCalled()
    })

    it('aborts without opting in when the confirmation is dismissed', async () => {
        mockRequestByType.mockResolvedValueOnce(undefined) // confirmation dismissed

        const { result } = renderHook(() => useAssetOptInDeeplink())

        await act(async () => {
            await result.current({ assetId: ASSET_ID, address: LINK_ADDRESS })
        })

        expect(mockOptIn).not.toHaveBeenCalled()
    })

    it('surfaces a readable error when the opt-in mutation throws (e.g. already opted in)', async () => {
        mockRequestByType.mockResolvedValueOnce('confirm')
        const optInError = new Error(
            'Account is already opted in to this asset',
        )
        mockOptIn.mockRejectedValueOnce(optInError)

        const { result } = renderHook(() => useAssetOptInDeeplink())

        await act(async () => {
            await result.current({ assetId: ASSET_ID, address: LINK_ADDRESS })
        })

        expect(mockShowError).toHaveBeenCalledWith(
            optInError,
            'add_asset.opt_in.failed_title',
        )
        expect(mockShowToast).not.toHaveBeenCalled()
    })

    it('stays silent when the user rejects signing', async () => {
        mockRequestByType.mockResolvedValueOnce('confirm')
        mockOptIn.mockRejectedValueOnce(new UserRejectedSigningError())

        const { result } = renderHook(() => useAssetOptInDeeplink())

        await act(async () => {
            await result.current({ assetId: ASSET_ID, address: LINK_ADDRESS })
        })

        expect(mockShowError).not.toHaveBeenCalled()
        expect(mockShowToast).not.toHaveBeenCalled()
    })
})
