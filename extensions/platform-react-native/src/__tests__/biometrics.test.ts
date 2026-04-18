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

import { describe, test, expect, vi, beforeEach } from 'vitest'

const isSensorAvailableMock = vi.hoisted(() => vi.fn())
const authenticateWithOptionsMock = vi.hoisted(() => vi.fn())

vi.mock('@sbaiahmed1/react-native-biometrics', () => ({
    isSensorAvailable: isSensorAvailableMock,
    authenticateWithOptions: authenticateWithOptionsMock,
    BiometricStrength: { Strong: 'Strong', Weak: 'Weak' },
}))

import { RNBiometricsService } from '../services/biometrics'

describe('RNBiometricsService', () => {
    const service = new RNBiometricsService()

    beforeEach(() => {
        isSensorAvailableMock.mockReset()
        authenticateWithOptionsMock.mockReset()
    })

    describe('getSupportedBiometricType', () => {
        test('returns null when no sensor is available', async () => {
            isSensorAvailableMock.mockResolvedValue({ available: false })
            expect(await service.getSupportedBiometricType()).toBeNull()
        })

        test.each([
            ['FaceID', 'face'],
            ['TouchID', 'fingerprint'],
            ['Biometrics', 'biometrics'],
        ] as const)('maps %s to %s', async (biometryType, expected) => {
            isSensorAvailableMock.mockResolvedValue({
                available: true,
                biometryType,
            })
            expect(await service.getSupportedBiometricType()).toBe(expected)
        })

        test('returns null for unknown biometry types', async () => {
            isSensorAvailableMock.mockResolvedValue({
                available: true,
                biometryType: 'Mystery',
            })
            expect(await service.getSupportedBiometricType()).toBeNull()
        })
    })

    describe('checkBiometricsAvailable', () => {
        test('returns true when a supported type exists', async () => {
            isSensorAvailableMock.mockResolvedValue({
                available: true,
                biometryType: 'FaceID',
            })
            expect(await service.checkBiometricsAvailable()).toBe(true)
        })

        test('returns false when no type is supported', async () => {
            isSensorAvailableMock.mockResolvedValue({ available: false })
            expect(await service.checkBiometricsAvailable()).toBe(false)
        })
    })

    describe('authenticate', () => {
        test('returns the native success flag', async () => {
            authenticateWithOptionsMock.mockResolvedValue({ success: true })
            expect(await service.authenticate('t', 'd')).toBe(true)
        })

        test('returns false when the native call throws', async () => {
            authenticateWithOptionsMock.mockRejectedValue(
                new Error('cancelled'),
            )
            expect(await service.authenticate()).toBe(false)
        })
    })
})
