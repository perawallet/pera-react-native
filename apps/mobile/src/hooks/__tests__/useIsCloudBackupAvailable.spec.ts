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

import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useRemoteConfigStore } from '@perawallet/wallet-core-remote-config'
import { setCapabilityOverrides } from '@test-utils/capability-overrides'
import type { WalletAccount } from '@perawallet/wallet-core-accounts'
import {
    useIsCloudBackupAvailable,
    useIsCloudBackupAvailableFor,
} from '../useIsCloudBackupAvailable'

const mocks = vi.hoisted(() => ({ isFlagOn: false, hasBackupChains: true }))

vi.mock('@perawallet/wallet-core-backup', () => ({
    hasBackupChains: () => mocks.hasBackupChains,
}))

vi.mock('@hooks/useIsCloudBackupEnabled', () => ({
    useIsCloudBackupEnabled: () => mocks.isFlagOn,
}))

describe('useIsCloudBackupAvailable', () => {
    afterEach(() => {
        useRemoteConfigStore.getState().resetState()
    })

    it.each([
        { isFlagOn: true, hasCapability: true, expected: true },
        { isFlagOn: false, hasCapability: true, expected: false },
        { isFlagOn: true, hasCapability: false, expected: false },
        { isFlagOn: false, hasCapability: false, expected: false },
    ])(
        'is $expected with the flag $isFlagOn and the capability $hasCapability',
        ({ isFlagOn, hasCapability, expected }) => {
            mocks.isFlagOn = isFlagOn
            setCapabilityOverrides({ cloudBackup: hasCapability })

            const { result } = renderHook(() => useIsCloudBackupAvailable())

            expect(result.current).toBe(expected)
        },
    )
})

describe('useIsCloudBackupAvailableFor', () => {
    const account = { id: 'a' } as WalletAccount

    afterEach(() => {
        useRemoteConfigStore.getState().resetState()
    })

    it.each([
        { hasBackupChains: true, expected: true },
        { hasBackupChains: false, expected: false },
    ])(
        'is $expected when the account is on a backed-up chain: $hasBackupChains',
        ({ hasBackupChains, expected }) => {
            mocks.isFlagOn = true
            mocks.hasBackupChains = hasBackupChains
            setCapabilityOverrides({ cloudBackup: true })

            const { result } = renderHook(() =>
                useIsCloudBackupAvailableFor(account),
            )

            expect(result.current).toBe(expected)
        },
    )

    it('is false without an account', () => {
        mocks.isFlagOn = true
        mocks.hasBackupChains = true
        setCapabilityOverrides({ cloudBackup: true })

        const { result } = renderHook(() =>
            useIsCloudBackupAvailableFor(undefined),
        )

        expect(result.current).toBe(false)
    })

    it('is false while Cloud Backup is unavailable', () => {
        mocks.isFlagOn = false
        mocks.hasBackupChains = true
        setCapabilityOverrides({ cloudBackup: true })

        const { result } = renderHook(() =>
            useIsCloudBackupAvailableFor(account),
        )

        expect(result.current).toBe(false)
    })
})
