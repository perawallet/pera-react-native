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

const { notificationsStoreMock } = vi.hoisted(() => ({
    notificationsStoreMock: {
        setAccountNotificationEnabled: vi.fn(),
    },
}))

vi.mock('@perawallet/wallet-core-messages', () => ({
    useNotificationsStore: { getState: () => notificationsStoreMock },
}))

import { migrateNotificationMutes } from '../migrateNotifications'

beforeEach(() => {
    notificationsStoreMock.setAccountNotificationEnabled.mockReset()
})

describe('migrateNotificationMutes', () => {
    it('returns zero muted and writes nothing when input is empty', () => {
        const result = migrateNotificationMutes([])

        expect(result).toEqual({ muted: 0 })
        expect(
            notificationsStoreMock.setAccountNotificationEnabled,
        ).not.toHaveBeenCalled()
    })

    it('calls setAccountNotificationEnabled(address, false) for every muted address', () => {
        const result = migrateNotificationMutes(['ADDR_A', 'ADDR_B', 'ADDR_C'])

        expect(result).toEqual({ muted: 3 })
        expect(
            notificationsStoreMock.setAccountNotificationEnabled,
        ).toHaveBeenNthCalledWith(1, 'ADDR_A', false)
        expect(
            notificationsStoreMock.setAccountNotificationEnabled,
        ).toHaveBeenNthCalledWith(2, 'ADDR_B', false)
        expect(
            notificationsStoreMock.setAccountNotificationEnabled,
        ).toHaveBeenNthCalledWith(3, 'ADDR_C', false)
    })

    it('counts duplicates in the input as separate mute calls', () => {
        const result = migrateNotificationMutes(['ADDR', 'ADDR'])

        expect(result).toEqual({ muted: 2 })
        expect(
            notificationsStoreMock.setAccountNotificationEnabled,
        ).toHaveBeenCalledTimes(2)
    })
})
