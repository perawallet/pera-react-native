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

const { settingsMock } = vi.hoisted(() => ({
    settingsMock: { setPreference: vi.fn() },
}))

vi.mock('@perawallet/wallet-core-settings', () => ({
    useSettingsStore: { getState: () => settingsMock },
}))

import type { LegacyPasskey } from '@perawallet/wallet-extension-platform'
import { migrateStashed } from '../migrateStashed'

const buildPasskey = (overrides: Partial<LegacyPasskey> = {}): LegacyPasskey =>
    ({
        credentialId: 'cred-1',
        address: 'ADDR_A',
        siteUrl: 'https://example.test',
        siteName: null,
        userName: null,
        userDisplayName: null,
        userHandle: null,
        lastUsedAtMs: null,
        ...overrides,
    }) as LegacyPasskey

beforeEach(() => {
    settingsMock.setPreference.mockReset()
})

describe('migrateStashed', () => {
    it('writes nothing and reports zero when input is empty', () => {
        const result = migrateStashed({
            passkeys: [],
            walletConnectHistoryBlob: null,
        })

        expect(result).toEqual({ passkeysStashed: 0 })
        expect(settingsMock.setPreference).not.toHaveBeenCalled()
    })

    it('stashes passkeys as a JSON string under legacy.passkeys', () => {
        const passkeys = [
            buildPasskey({ credentialId: 'a' }),
            buildPasskey({ credentialId: 'b' }),
        ]

        const result = migrateStashed({
            passkeys,
            walletConnectHistoryBlob: null,
        })

        expect(result.passkeysStashed).toBe(2)
        expect(settingsMock.setPreference).toHaveBeenCalledWith(
            'legacy.passkeys',
            JSON.stringify(passkeys),
        )
    })

    it('stashes the walletConnect history blob when provided', () => {
        const result = migrateStashed({
            passkeys: [],
            walletConnectHistoryBlob: 'opaque-blob',
        })

        expect(result.passkeysStashed).toBe(0)
        expect(settingsMock.setPreference).toHaveBeenCalledWith(
            'legacy.walletConnectHistoryBlob',
            'opaque-blob',
        )
    })

    it('stashes an empty walletConnect blob (empty string is not null)', () => {
        migrateStashed({
            passkeys: [],
            walletConnectHistoryBlob: '',
        })

        expect(settingsMock.setPreference).toHaveBeenCalledWith(
            'legacy.walletConnectHistoryBlob',
            '',
        )
    })

    it('skips the blob preference when undefined', () => {
        migrateStashed({ passkeys: [] })

        expect(settingsMock.setPreference).not.toHaveBeenCalled()
    })

    it('stashes both passkeys and blob when both are present', () => {
        const passkeys = [buildPasskey()]

        migrateStashed({
            passkeys,
            walletConnectHistoryBlob: 'blob',
        })

        expect(settingsMock.setPreference).toHaveBeenCalledTimes(2)
        expect(settingsMock.setPreference).toHaveBeenCalledWith(
            'legacy.passkeys',
            JSON.stringify(passkeys),
        )
        expect(settingsMock.setPreference).toHaveBeenCalledWith(
            'legacy.walletConnectHistoryBlob',
            'blob',
        )
    })
})
