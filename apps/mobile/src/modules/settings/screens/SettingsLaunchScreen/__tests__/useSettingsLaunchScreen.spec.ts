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

import { vi, describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import type { WalletAccount } from '@perawallet/wallet-core-accounts'
import { useSettingsLaunchScreen } from '../useSettingsLaunchScreen'

const alice: WalletAccount = {
    id: '1',
    name: 'Alice',
    type: 'algo25',
    address: 'ALICE-ADDR',
    keyPairId: 'kp-1',
}
const bob: WalletAccount = {
    id: '2',
    name: 'Bob',
    type: 'algo25',
    address: 'BOB-ADDR',
    keyPairId: 'kp-2',
}

const storeState = vi.hoisted(() => ({
    current: {
        launchAccountMode: 'lastUsed' as string,
        launchAccountAddress: null as string | null,
        setLaunchAccountPreference: vi.fn(),
    },
}))
const mockAccounts = vi.hoisted(() => ({ current: [] as WalletAccount[] }))

vi.mock('@perawallet/wallet-core-accounts', () => ({
    LaunchAccountModes: { lastUsed: 'lastUsed', specific: 'specific' },
    useAllAccounts: () => mockAccounts.current,
    useAccountsStore: (selector: (state: unknown) => unknown) =>
        selector(storeState.current),
}))

describe('useSettingsLaunchScreen', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockAccounts.current = [alice, bob]
        storeState.current = {
            launchAccountMode: 'lastUsed',
            launchAccountAddress: null,
            setLaunchAccountPreference:
                storeState.current.setLaunchAccountPreference,
        }
    })

    it('hides the account picker under lastUsed', () => {
        const { result } = renderHook(() => useSettingsLaunchScreen())

        expect(result.current.isAccountPickerVisible).toBe(false)
    })

    it('shows the account picker under specific', () => {
        storeState.current.launchAccountMode = 'specific'
        storeState.current.launchAccountAddress = 'BOB-ADDR'

        const { result } = renderHook(() => useSettingsLaunchScreen())

        expect(result.current.isAccountPickerVisible).toBe(true)
        expect(result.current.launchAccountAddress).toBe('BOB-ADDR')
    })

    it('clears the pin when lastUsed is chosen', () => {
        const { result } = renderHook(() => useSettingsLaunchScreen())

        act(() => result.current.handleSelectLastUsed())

        expect(
            storeState.current.setLaunchAccountPreference,
        ).toHaveBeenCalledWith('lastUsed')
    })

    it('pins the first account when specific is chosen with no prior pin', () => {
        const { result } = renderHook(() => useSettingsLaunchScreen())

        act(() => result.current.handleSelectSpecific())

        expect(
            storeState.current.setLaunchAccountPreference,
        ).toHaveBeenCalledWith('specific', 'ALICE-ADDR')
    })

    it('restores the previous pin when specific is re-chosen', () => {
        storeState.current.launchAccountAddress = 'BOB-ADDR'

        const { result } = renderHook(() => useSettingsLaunchScreen())

        act(() => result.current.handleSelectSpecific())

        expect(
            storeState.current.setLaunchAccountPreference,
        ).toHaveBeenCalledWith('specific', 'BOB-ADDR')
    })

    it('does not re-pin when specific is already active', () => {
        storeState.current.launchAccountMode = 'specific'
        storeState.current.launchAccountAddress = 'BOB-ADDR'

        const { result } = renderHook(() => useSettingsLaunchScreen())

        act(() => result.current.handleSelectSpecific())

        expect(
            storeState.current.setLaunchAccountPreference,
        ).not.toHaveBeenCalled()
    })

    it('pins the account chosen from the picker', () => {
        const { result } = renderHook(() => useSettingsLaunchScreen())

        act(() => result.current.handleSelectAccount(bob))

        expect(
            storeState.current.setLaunchAccountPreference,
        ).toHaveBeenCalledWith('specific', 'BOB-ADDR')
    })

    it('leaves the address undefined when there are no accounts to pin', () => {
        mockAccounts.current = []

        const { result } = renderHook(() => useSettingsLaunchScreen())

        act(() => result.current.handleSelectSpecific())

        expect(
            storeState.current.setLaunchAccountPreference,
        ).toHaveBeenCalledWith('specific', undefined)
    })
})
