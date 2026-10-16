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

import * as parserStub from '../dev-e2e-fixture-parser.stub'
import * as handlerStub from '../handlers/useE2eFixtureDeeplink.stub'

// Metro alone resolves a `.stub.ts`, so these type-level assignments are the
// only check that each stub still substitutes for the module it replaces.
const parser: typeof import('../dev-e2e-fixture-parser') = parserStub
const handler: typeof import('../handlers/useE2eFixtureDeeplink') = handlerStub

describe('e2e fixture stubs', () => {
    it('parse nothing, so the fixture URL falls through to HOME', () => {
        expect(
            parser.parseDevE2eFixtureUri(
                'perawallet://app/dev/e2e-fixture?name=contacts-empty',
            ),
        ).toBeNull()
        expect(
            parser.isDevE2eFixtureDeeplink({
                type: 'DEV_E2E_FIXTURE',
                sourceUrl: '',
                fixture: 'contacts-empty',
            }),
        ).toBe(false)
    })

    it('resolve the handler to one that changes nothing', () => {
        expect(
            handler.useE2eFixtureDeeplink()({ fixture: 'contacts-one' }),
        ).toBeUndefined()
    })
})
