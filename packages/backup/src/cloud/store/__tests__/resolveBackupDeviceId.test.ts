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

import { describe, test, expect, beforeEach, vi } from 'vitest'

const { deviceIDs } = vi.hoisted(() => ({
    deviceIDs: new Map<string, string>(),
}))

vi.mock('@perawallet/wallet-core-device', () => ({
    useDeviceStore: { getState: () => ({ deviceIDs }) },
}))

import { useCloudBackupStore } from '../store'
import { resolveBackupDeviceId } from '../resolveBackupDeviceId'

beforeEach(() => {
    useCloudBackupStore.getState().resetState()
    deviceIDs.clear()
    deviceIDs.set('mainnet', 'push-device')
})

describe('resolveBackupDeviceId', () => {
    test('prefers the id the backup was configured with', () => {
        useCloudBackupStore.getState().setConfigured({
            backupId: 'did:pera:abc',
            salt: 'c2FsdA==',
            deviceId: 'registered-device',
        })
        expect(resolveBackupDeviceId('mainnet')).toBe('registered-device')
    })

    test('falls back to the current network device id when none was pinned', () => {
        expect(resolveBackupDeviceId('mainnet')).toBe('push-device')
    })

    test('is null when the network has no device id either', () => {
        deviceIDs.clear()
        expect(resolveBackupDeviceId('mainnet')).toBeNull()
    })
})
