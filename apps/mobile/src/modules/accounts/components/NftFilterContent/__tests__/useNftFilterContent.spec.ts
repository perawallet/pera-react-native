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
import { renderHook, act } from '@test-utils/render'
import { useSelectedAccount } from '@perawallet/wallet-core-accounts'
import { useRemoteConfigStore } from '@perawallet/wallet-core-remote-config'
import { setCapabilityOverrides } from '@test-utils/capability-overrides'
import { useNftFilterContent } from '../useNftFilterContent'

const ALGORAND_ACCOUNT = {
    id: 'algo',
    custody: { kind: 'watch' },
    chains: { algorand: { address: 'ALGO' } },
}

const h = vi.hoisted(() => ({
    state: {
        showOptedIn: false,
        showWatchAccounts: true,
        setShowOptedIn: vi.fn(),
        setShowWatchAccounts: vi.fn(),
    },
}))

vi.mock('@perawallet/wallet-core-assets', () => ({
    useCollectiblePreferencesStore: (selector: (state: unknown) => unknown) =>
        selector(h.state),
}))

describe('useNftFilterContent', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        h.state.showOptedIn = false
        h.state.showWatchAccounts = true
        useRemoteConfigStore.getState().resetState()
        vi.mocked(useSelectedAccount).mockReturnValue(ALGORAND_ACCOUNT as never)
    })

    it('offers the opted-in toggle on a gallery chain with opt-in', () => {
        const { result } = renderHook(() => useNftFilterContent())

        expect(result.current.canShowOptedIn).toBe(true)
    })

    it('hides the opted-in toggle when no gallery chain manages assets', () => {
        act(() => setCapabilityOverrides({ manageAssets: false }))

        const { result } = renderHook(() => useNftFilterContent())

        expect(result.current.canShowOptedIn).toBe(false)
    })

    it('initialises the draft from the stored preferences', () => {
        const { result } = renderHook(() => useNftFilterContent())

        expect(result.current.showOptedIn).toBe(false)
        expect(result.current.showWatchAccounts).toBe(true)
    })

    it('toggles update the draft without writing to the store', () => {
        const { result } = renderHook(() => useNftFilterContent())

        act(() => result.current.handleToggleOptedIn())
        act(() => result.current.handleToggleWatchAccounts())

        expect(result.current.showOptedIn).toBe(true)
        expect(result.current.showWatchAccounts).toBe(false)
        expect(h.state.setShowOptedIn).not.toHaveBeenCalled()
        expect(h.state.setShowWatchAccounts).not.toHaveBeenCalled()
    })

    it('writes the draft toggles to the store only on commit', () => {
        const { result } = renderHook(() => useNftFilterContent())

        act(() => result.current.handleToggleOptedIn())
        act(() => result.current.commitChanges())

        expect(h.state.setShowOptedIn).toHaveBeenCalledWith(true)
        expect(h.state.setShowWatchAccounts).toHaveBeenCalledWith(true)
    })
})
