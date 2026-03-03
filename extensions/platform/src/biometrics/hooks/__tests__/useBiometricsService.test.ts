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

import { describe, test, expect, vi } from 'vitest'
import { registerTestPlatform } from '../../../test-utils'
import { useBiometricsService } from '../useBiometricsService'
import type { BiometricsService } from '../../models'

describe('services/biometrics/hooks', () => {
    test('useBiometricsService resolves the biometrics service from the provider', () => {
        const dummy: BiometricsService = {
            getSupportedBiometricType: vi.fn().mockResolvedValue('fingerprint'),
            checkBiometricsAvailable: vi.fn().mockResolvedValue(true),
            authenticate: vi.fn().mockResolvedValue(true),
        }

        registerTestPlatform({ biometrics: dummy })

        const svc = useBiometricsService()
        expect(svc).toBe(dummy)
    })

    test('getSupportedBiometricType returns the expected biometric type', async () => {
        const dummy: BiometricsService = {
            getSupportedBiometricType: vi.fn().mockResolvedValue('face'),
            checkBiometricsAvailable: vi.fn().mockResolvedValue(true),
            authenticate: vi.fn().mockResolvedValue(true),
        }

        registerTestPlatform({ biometrics: dummy })

        const svc = useBiometricsService()
        const type = await svc.getSupportedBiometricType()
        expect(type).toBe('face')
        expect(dummy.getSupportedBiometricType).toHaveBeenCalledTimes(1)
    })

    test('authenticate forwards prompt arguments to the service', async () => {
        const dummy: BiometricsService = {
            getSupportedBiometricType: vi.fn().mockResolvedValue('fingerprint'),
            checkBiometricsAvailable: vi.fn().mockResolvedValue(true),
            authenticate: vi.fn().mockResolvedValue(true),
        }

        registerTestPlatform({ biometrics: dummy })

        const svc = useBiometricsService()
        const result = await svc.authenticate('Unlock', 'Confirm identity')
        expect(result).toBe(true)
        expect(dummy.authenticate).toHaveBeenCalledWith(
            'Unlock',
            'Confirm identity',
        )
    })
})
