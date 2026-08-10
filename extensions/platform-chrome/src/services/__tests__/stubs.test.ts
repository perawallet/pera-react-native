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

import { describe, expect, it } from 'vitest'
import {
    ChromeAgeGateService,
    ChromeAppIntegrityService,
    ChromeBiometricsService,
    ChromeMigrationService,
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
            new ChromeAgeGateService().requestAgeRange(18),
        ).resolves.toEqual({ status: 'unknown', source: 'self-declared' })
        await expect(
            new ChromeMigrationService().hasLegacyData(),
        ).resolves.toBe(false)
    })
})
