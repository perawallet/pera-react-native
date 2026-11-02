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

import { describe, expect, it, vi } from 'vitest'
import { sendFlowHeaderOptions } from '../sendFlowHeaderOptions'

vi.mock('../../../components/send-funds/SendFlowCloseButton', () => ({
    SendFlowCloseButton: () => null,
}))

describe('sendFlowHeaderOptions', () => {
    it('removes the back chevron on the first screen', () => {
        const options = sendFlowHeaderOptions(
            'AssetSelection',
            'AssetSelection',
        )

        expect(options.headerLeft?.()).toBeNull()
    })

    it('leaves the default back chevron on every later screen', () => {
        const options = sendFlowHeaderOptions('InputAmount', 'AssetSelection')

        expect(options.headerLeft).toBeUndefined()
    })

    it('puts the close button on the right of every screen', () => {
        const first = sendFlowHeaderOptions('ChainSelection', 'ChainSelection')
        const later = sendFlowHeaderOptions(
            'ConfirmTransaction',
            'ChainSelection',
        )

        expect(first.headerRight().type).toBe(later.headerRight().type)
        expect(first.headerRight().type).not.toBeUndefined()
    })
})
