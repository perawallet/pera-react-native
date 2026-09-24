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
    transformAttestResponse,
    transformVerifyResponse,
} from '../transformers'

describe('integrity transformers', () => {
    it('maps attest response to camelCase registration', () => {
        const result = transformAttestResponse({
            integrity_token: 'jwt',
            expires_at: '2026-07-01T00:00:00.000Z',
        })
        expect(result).toEqual({
            integrityToken: 'jwt',
            expiresAt: '2026-07-01T00:00:00.000Z',
        })
    })
    it('maps verify response to camelCase verification', () => {
        const result = transformVerifyResponse({
            ok: true,
            device_id: 'device-1',
            platform: 'android',
        })
        expect(result).toEqual({
            ok: true,
            deviceInstallationId: 'device-1',
            platform: 'android',
        })
    })
})
