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

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import {
    useInputScreenActions,
    type UseInputScreenActionsProps,
} from '../useInputScreenActions'

const mocks = vi.hoisted(() => ({
    navigate: vi.fn(),
    requestBottomSheet: vi.fn(),
    getPreference: vi.fn(),
}))

vi.mock('@react-navigation/native', () => ({
    useNavigation: () => ({ navigate: mocks.navigate }),
    useIsFocused: () => true,
}))

vi.mock('@modules/bottom-sheet', () => ({
    useBottomSheet: () => ({ request: mocks.requestBottomSheet }),
}))

vi.mock('@hooks/useLanguage', () => ({
    useLanguage: () => ({ t: (key: string) => key }),
}))

vi.mock('@perawallet/wallet-core-settings', () => ({
    usePreferences: () => ({ getPreference: mocks.getPreference }),
}))

vi.mock('@perawallet/wallet-core-accounts', () => ({
    useSelectedAccount: () => null,
}))

vi.mock('@modules/transactions/hooks', () => ({
    useSendScope: () => ({ chainId: 'algorand' }),
}))

const props: UseInputScreenActionsProps = {
    asset: undefined,
    accountAssetBalance: null,
    isBalanceReady: false,
    cryptoValue: undefined,
    isResolvingDestination: false,
    handleKey: vi.fn(),
    handlePaste: vi.fn(),
    handleNext: vi.fn(),
}

describe('useInputScreenActions', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.getPreference.mockReturnValue(true)
    })

    afterEach(() => {
        vi.useRealTimers()
    })

    it('goes back to the asset picker when the send can pick an asset', () => {
        const { result } = renderHook(() =>
            useInputScreenActions({ ...props, canSelectAsset: true }),
        )

        act(() => result.current.handleBack())

        expect(mocks.navigate).toHaveBeenCalledWith('AssetSelection')
    })

    it('finishes the send when no asset can be picked', () => {
        const onFinished = vi.fn()
        const { result } = renderHook(() =>
            useInputScreenActions({ ...props, onFinished }),
        )

        act(() => result.current.handleBack())

        expect(mocks.navigate).not.toHaveBeenCalled()
        expect(onFinished).toHaveBeenCalled()
    })

    it('opens the info sheet once when the prompt was not agreed to', () => {
        vi.useFakeTimers()
        mocks.getPreference.mockReturnValue(false)
        const { rerender } = renderHook(() => useInputScreenActions(props))

        act(() => {
            vi.runAllTimers()
        })
        rerender()

        expect(mocks.requestBottomSheet).toHaveBeenCalledTimes(1)
    })

    it('leaves the info sheet alone once the prompt was agreed to', () => {
        vi.useFakeTimers()
        const { rerender } = renderHook(() => useInputScreenActions(props))

        act(() => {
            vi.runAllTimers()
        })
        rerender()

        expect(mocks.requestBottomSheet).not.toHaveBeenCalled()
    })
})
