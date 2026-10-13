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

import { describe, expect, it } from 'vitest'
import {
    ChromeAgeGateService,
    ChromeAppIntegrityService,
    ChromeBiometricsService,
    ChromeCloudFileStorageService,
    ChromeMigrationService,
    ChromeWalletProvisioningService,
} from '../stubs'

describe('capability stubs', () => {
    it('reports unsupported/none capabilities', async () => {
        await expect(
            new ChromeAppIntegrityService().isSupported(),
        ).resolves.toBe(false)
        await expect(
            new ChromeBiometricsService().getSecurityLevel(),
        ).resolves.toBe('none')
        await expect(
            new ChromeBiometricsService().checkEnrollmentBinding(),
        ).resolves.toBe('unavailable')
        await expect(
            new ChromeAgeGateService().requestAgeRange(18),
        ).resolves.toEqual({ status: 'unknown', source: 'self-declared' })
        await expect(
            new ChromeMigrationService().hasLegacyData(),
        ).resolves.toBe(false)
    })

    it('exposes no migration dev tools, having no legacy store to write', () => {
        expect(new ChromeMigrationService().devTools).toBeUndefined()
    })

    it('refuses to arm or unwrap, having no OS biometric to bind to', async () => {
        const service = new ChromeBiometricsService()

        await expect(service.armBiometricBinding()).resolves.toBeNull()
        await expect(service.unwrapBiometricToken('anything')).resolves.toEqual(
            {
                success: false,
                reason: 'unavailable',
            },
        )
        const session = service.beginBiometricUnwrap()
        await expect(session.authenticated).resolves.toEqual({
            success: false,
            reason: 'unavailable',
        })
        await expect(session.finish('anything')).resolves.toEqual({
            success: false,
            reason: 'unavailable',
        })
    })

    it('reports migration as already done, so the migrator never runs on web', async () => {
        const service = new ChromeMigrationService()

        await expect(service.isMigrationComplete()).resolves.toBe(true)
        await expect(service.getMigrationPlans()).resolves.toEqual([])
        await expect(service.getLegacyData()).rejects.toThrow()
    })

    it('rejects attestation rather than returning a token nobody can verify', async () => {
        await expect(
            new ChromeAppIntegrityService().attest('challenge'),
        ).rejects.toThrow()
    })

    it('reports no OS wallet and rejects both add-card flows', async () => {
        const service = new ChromeWalletProvisioningService()

        await expect(service.checkWalletAvailability()).resolves.toBe(false)
        await expect(service.getCardStatusBySuffix()).resolves.toBe('not found')
        await expect(service.addCardToAppleWallet()).rejects.toThrow()
        await expect(service.addCardToGoogleWallet()).rejects.toThrow()
    })

    it('offers no cloud store and rejects transfers', async () => {
        const service = new ChromeCloudFileStorageService()

        expect(service.getAvailableStores()).toEqual([])
        await expect(service.save()).rejects.toThrow()
        await expect(service.read()).rejects.toThrow()
    })
})
