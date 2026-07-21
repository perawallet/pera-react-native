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

const { deviceStoreMock, settingsStoreMock } = vi.hoisted(() => ({
    deviceStoreMock: { setDeviceID: vi.fn() },
    settingsStoreMock: { setPreference: vi.fn() },
}))

vi.mock('@perawallet/wallet-core-config', () => ({
    Networks: { mainnet: 'mainnet', testnet: 'testnet' },
}))

vi.mock('@perawallet/wallet-core-device', () => ({
    useDeviceStore: { getState: () => deviceStoreMock },
}))

vi.mock('@perawallet/wallet-core-settings', () => ({
    useSettingsStore: { getState: () => settingsStoreMock },
}))

import type { LegacyDeviceIdentifiers } from '@perawallet/wallet-extension-platform'
import { migrateDeviceIdentifiers } from '../migrateDevice'

const buildIdentifiers = (
    overrides: Partial<LegacyDeviceIdentifiers> = {},
): LegacyDeviceIdentifiers => ({
    notificationUserId: null,
    mainnetDeviceId: null,
    testnetDeviceId: null,
    lastSeenNotificationId: null,
    legacyFallbackDeviceId: null,
    ...overrides,
})

beforeEach(() => {
    deviceStoreMock.setDeviceID.mockReset()
    settingsStoreMock.setPreference.mockReset()
})

describe('migrateDeviceIdentifiers', () => {
    it('does nothing when every identifier is null', () => {
        migrateDeviceIdentifiers(buildIdentifiers())

        expect(deviceStoreMock.setDeviceID).not.toHaveBeenCalled()
        expect(settingsStoreMock.setPreference).not.toHaveBeenCalled()
    })

    it('writes the mainnet device id under the mainnet network', () => {
        migrateDeviceIdentifiers(buildIdentifiers({ mainnetDeviceId: 'M1' }))

        expect(deviceStoreMock.setDeviceID).toHaveBeenCalledWith(
            'mainnet',
            'M1',
        )
        expect(deviceStoreMock.setDeviceID).toHaveBeenCalledTimes(1)
    })

    it('writes the testnet device id under the testnet network', () => {
        migrateDeviceIdentifiers(buildIdentifiers({ testnetDeviceId: 'T1' }))

        expect(deviceStoreMock.setDeviceID).toHaveBeenCalledWith(
            'testnet',
            'T1',
        )
        expect(deviceStoreMock.setDeviceID).toHaveBeenCalledTimes(1)
    })

    it('writes both device ids when both are present', () => {
        migrateDeviceIdentifiers(
            buildIdentifiers({ mainnetDeviceId: 'M', testnetDeviceId: 'T' }),
        )

        expect(deviceStoreMock.setDeviceID).toHaveBeenCalledWith('mainnet', 'M')
        expect(deviceStoreMock.setDeviceID).toHaveBeenCalledWith('testnet', 'T')
        expect(deviceStoreMock.setDeviceID).toHaveBeenCalledTimes(2)
    })

    it('persists notificationUserId and lastSeenNotificationId as preferences', () => {
        migrateDeviceIdentifiers(
            buildIdentifiers({
                notificationUserId: 'user-1',
                lastSeenNotificationId: 42,
            }),
        )

        expect(settingsStoreMock.setPreference).toHaveBeenCalledWith(
            'legacy.device.notificationUserId',
            'user-1',
        )
        expect(settingsStoreMock.setPreference).toHaveBeenCalledWith(
            'legacy.device.lastSeenNotificationId',
            42,
        )
    })

    it('persists lastSeenNotificationId when it is zero (not null)', () => {
        migrateDeviceIdentifiers(
            buildIdentifiers({ lastSeenNotificationId: 0 }),
        )

        expect(settingsStoreMock.setPreference).toHaveBeenCalledWith(
            'legacy.device.lastSeenNotificationId',
            0,
        )
    })

    it('does not write preferences whose values are null', () => {
        migrateDeviceIdentifiers(buildIdentifiers({ mainnetDeviceId: 'M' }))

        expect(settingsStoreMock.setPreference).not.toHaveBeenCalled()
    })

    it('falls back to the legacy single device id for mainnet when no per-network id exists', () => {
        migrateDeviceIdentifiers({
            notificationUserId: null,
            mainnetDeviceId: null,
            testnetDeviceId: null,
            lastSeenNotificationId: null,
            legacyFallbackDeviceId: 'LEGACY-1',
        })
        expect(deviceStoreMock.setDeviceID).toHaveBeenCalledWith(
            'mainnet',
            'LEGACY-1',
        )
    })

    it('prefers the per-network id over the legacy fallback', () => {
        migrateDeviceIdentifiers({
            notificationUserId: null,
            mainnetDeviceId: 'MAIN-1',
            testnetDeviceId: null,
            lastSeenNotificationId: null,
            legacyFallbackDeviceId: 'LEGACY-1',
        })
        expect(deviceStoreMock.setDeviceID).toHaveBeenCalledWith(
            'mainnet',
            'MAIN-1',
        )
        expect(deviceStoreMock.setDeviceID).not.toHaveBeenCalledWith(
            'mainnet',
            'LEGACY-1',
        )
    })
})
