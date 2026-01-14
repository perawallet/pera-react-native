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

import { describe, it, expect } from 'vitest'

// TODO: RootComponent integration test is skipped because it requires
// deep native dependencies that use Flow types, which cannot be properly
// transpiled in a web-based test environment. This component should be
// tested through E2E tests (e.g., Detox, Maestro) instead.
//
// The SyntaxError 'Unexpected token typeof' occurs when the test tries
// to load deeply nested modules with Flow syntax.

describe('RootComponent', () => {
    it.skip('renders correctly', () => {
        // This test is skipped - see TODO above
        expect(true).toBe(true)
    })
})
