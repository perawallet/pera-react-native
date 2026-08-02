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

// Plain-JS spec (not .spec.ts) deliberately — see flash-list's sibling spec:
// web-shims/ is untyped JS outside tsc's include glob.
import { describe, it, expect } from 'vitest'
import PasskeyAutofillModule from '../react-native-passkey-autofill'

describe('react-native-passkey-autofill web shim', () => {
    // The security-load-bearing assertion. PasskeyAutofillService computes
    // `supportsDerivedMainKey` as `typeof native.setDerivedMainKey ===
    // 'function'`, and bootstrapPasskeyAutofill only stringifies the derived
    // main key to hex when that is true. Defining the method here — even as a
    // no-op — would materialize a non-zeroable hex copy of the key on web for
    // a bridge that discards it.
    it('does not define setDerivedMainKey', () => {
        expect(PasskeyAutofillModule.setDerivedMainKey).toBeUndefined()
    })

    // Absent on purpose so PasskeyAutofillService.subscribe() takes its own
    // documented fallback (returning a real `{ remove }`) rather than trusting
    // whatever we'd return here as a subscription object.
    it('does not define listener methods', () => {
        expect(PasskeyAutofillModule.addListener).toBeUndefined()
        expect(PasskeyAutofillModule.removeListeners).toBeUndefined()
    })

    it('exposes the read methods with empty-but-valid shapes', async () => {
        await expect(PasskeyAutofillModule.getHdRootKeyId()).resolves.toBeNull()
        await expect(
            PasskeyAutofillModule.getStoredCredentials(),
        ).resolves.toEqual([])
        await expect(PasskeyAutofillModule.getDiagnostics()).resolves.toEqual([])
    })
})
