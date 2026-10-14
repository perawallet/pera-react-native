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
import type { LegacyPreferences } from '@perawallet/wallet-extension-platform'
import { algorandLegacyPreferenceFlags } from '../legacyPreferenceFlags'

const preferences = (overrides: Partial<LegacyPreferences>) =>
    ({
        rekeySupport: null,
        arc59ExpressSendWarningEnabled: null,
        ...overrides,
    }) as LegacyPreferences

describe('algorandLegacyPreferenceFlags', () => {
    it('returns both Pera 6 flags under their persisted names', () => {
        expect(
            algorandLegacyPreferenceFlags(
                preferences({
                    rekeySupport: false,
                    arc59ExpressSendWarningEnabled: true,
                }),
            ),
        ).toEqual({
            rekeySupport: false,
            arc59ExpressSendWarningEnabled: true,
        })
    })

    it('keeps an unset flag as null so the migration skips it', () => {
        expect(algorandLegacyPreferenceFlags(preferences({}))).toEqual({
            rekeySupport: null,
            arc59ExpressSendWarningEnabled: null,
        })
    })
})
