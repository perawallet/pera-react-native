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
import { RemoteConfigDefaults, RemoteConfigKeys } from '../models'

describe('remote config defaults', () => {
    // The developer Feature Flags screen only lists keys whose default is a
    // boolean, so the type of the default is what makes the flag toggleable
    // on device, and `false` is what keeps the surface dark in a shipped build.
    it('ships the password manager dark, as a boolean the Feature Flags screen can toggle', () => {
        expect(RemoteConfigKeys.enable_password_manager).toBe(
            'enable_password_manager',
        )
        expect(RemoteConfigDefaults.enable_password_manager).toBe(false)
    })
})
