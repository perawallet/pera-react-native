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

import { render, fireEvent } from '@test-utils/render'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Text } from 'react-native'
import { InfoButton } from '../InfoButton'

const mockRequest = vi.fn().mockResolvedValue()

vi.mock('@modules/bottom-sheet', () => ({
    useBottomSheet: () => ({
        request: mockRequest,
    }),
    useBottomSheetResult: () => ({
        resolve: vi.fn(),
        dismiss: vi.fn(),
    }),
}))

describe('InfoButton', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('requests a bottom sheet when pressed', () => {
        const { container } = render(
            <InfoButton title='Test Info'>
                <Text>Body</Text>
            </InfoButton>,
        )

        const button = container.querySelector('[testid="info-button"]')
        expect(button).toBeTruthy()

        fireEvent.click(button!)
        expect(mockRequest).toHaveBeenCalledTimes(1)
        const call = mockRequest.mock.calls[0][0]
        expect(call.options).toMatchObject({
            size: 'auto',
            enablePanDownToClose: true,
        })
        expect(call.contents).toBeTruthy()
    })
})
