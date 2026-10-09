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
import { useIsCloudBackupAvailable } from '../useIsCloudBackupAvailable'

const mocks = vi.hoisted(() => ({ isFlagOn: false }))

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
