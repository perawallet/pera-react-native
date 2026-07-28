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

import { describe, it, expect, beforeEach } from 'vitest'
import { useBottomSheetStore } from '@modules/bottom-sheet'
import { OptInConfirmationContent } from '@modules/assets/components/OptInConfirmationContent'
// Side-effect: binds every registry entry.
import '../registrations'

describe('bottom-sheet registrations', () => {
    beforeEach(() => {
        useBottomSheetStore.getState().resetState()
        useBottomSheetStore.getState().registerBottomSheetHost()
    })

    it("'asset-opt-in' resolves to OptInConfirmationContent with typed props", () => {
        useBottomSheetStore.getState().requestByType('asset-opt-in', {
            assetId: '31566704',
            accountAddress: 'AAA',
        })

        const { requests } = useBottomSheetStore.getState()
        expect(requests).toHaveLength(1)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const element = requests[0].contents as any
        expect(element.type).toBe(OptInConfirmationContent)
        expect(element.props).toEqual({
            assetId: '31566704',
            accountAddress: 'AAA',
        })
    })
})
