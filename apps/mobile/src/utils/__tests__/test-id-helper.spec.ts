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

// @vitest-environment node

import { describe, expect, it } from 'vitest'
import { getTestProps } from '../test-id-helper'

describe('getTestProps', () => {
    it('returns no props without an id', () => {
        expect(getTestProps()).toEqual({})
    })

    it('exposes the suffixed id for automation without making it the accessibility label', () => {
        const props = getTestProps('send_button', 'icon')

        expect(props).toEqual({
            testID: 'send_button_icon',
            accessibilityIdentifier: 'send_button_icon',
            accessible: true,
        })
        expect(props).not.toHaveProperty('accessibilityLabel')
    })
})
