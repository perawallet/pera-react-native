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

import { renderHook, act } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useRemoteConfigStore } from '@perawallet/wallet-core-remote-config'
import { setCapabilityOverrides } from '@test-utils/capability-overrides'
import { useHandleMultisigNotification } from '../useHandleMultisigNotification'

const mocks = vi.hoisted(() => ({
    navigateToScreen: vi.fn(),
    refetch: vi.fn(),
}))

vi.mock('@modules/deeplink/core', () => ({
    navigateToScreen: mocks.navigateToScreen,
}))

vi.mock('@perawallet/wallet-core-messages', async importOriginal => ({
    ...(await importOriginal<object>()),
    useInboxQuery: () => ({ refetch: mocks.refetch }),
}))

vi.mock('../useHandleInboxItemPress', () => ({
    useHandleInboxItemPress: () => vi.fn(),
}))

describe('useHandleMultisigNotification', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.refetch.mockResolvedValue([])
        useRemoteConfigStore.getState().resetState()
    })

    it('opens the inbox for a multisig notification at the Algorand defaults', () => {
        const { result } = renderHook(() => useHandleMultisigNotification())

        act(() => result.current.handleMultisigNotification('sign', 'ADDR'))

        expect(mocks.navigateToScreen).toHaveBeenCalledTimes(1)
        expect(mocks.refetch).toHaveBeenCalledTimes(1)
    })

    it('does nothing while the multisig capability is off', () => {
        setCapabilityOverrides({ multisig: false })
        const { result } = renderHook(() => useHandleMultisigNotification())

        act(() => result.current.handleMultisigNotification('sign', 'ADDR'))

        expect(mocks.navigateToScreen).not.toHaveBeenCalled()
        expect(mocks.refetch).not.toHaveBeenCalled()
    })
})
