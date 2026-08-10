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

// Plain-JS spec (not .spec.tsx) deliberately — see react-native-pager-view's
// sibling spec for why: web-shims/ is untyped JS outside tsc's include glob.
import { describe, it, expect } from 'vitest'
import * as falconShim from '../falcon-1024'

describe('falcon-1024 web shim', () => {
    it('throws when generateKey is called', () => {
        expect(() => falconShim.generateKey()).toThrow(/unavailable on web/i)
    })

    it('throws when signCompressed is called', () => {
        expect(() => falconShim.signCompressed()).toThrow(/unavailable on web/i)
    })

    it('throws rather than reporting a zero-length public key', () => {
        expect(() => falconShim.FALCON_DET1024_PUBKEY_SIZE).toThrow(
            /unavailable/i,
        )
    })
})
