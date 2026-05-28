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

import { describe, expect, it, vi } from 'vitest'

// The extension eagerly imports the native Expo module at module load; stub it
// so the test never touches `requireNativeModule`. react-native is pulled in
// transitively by service.ts (Platform).
vi.mock('@algorandfoundation/react-native-passkey-autofill', () => ({
    default: { isProviderActive: vi.fn() },
}))
vi.mock('react-native', () => ({ Platform: { OS: 'ios' } }))

import { WithPasskeyAutofill } from '../extension'
import { PasskeyAutofillService } from '../service'

describe('WithPasskeyAutofill', () => {
    it('registers a PasskeyAutofillService on the provider and returns it', () => {
        const provider: Record<string, unknown> = {}

        const result = WithPasskeyAutofill(provider as never)

        expect(provider.passkeyAutofill).toBeInstanceOf(PasskeyAutofillService)
        // The same instance is both mutated onto the provider and returned, so
        // the composed provider and the extension's return value agree.
        expect(result.passkeyAutofill).toBe(provider.passkeyAutofill)
    })
})
