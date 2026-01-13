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

import { renderHook, act } from '@testing-library/react-native'
import { useClipboard } from '../clipboard'
import Clipboard from '@react-native-clipboard/clipboard'
import useToast from '../toast'

vi.mock('@react-native-clipboard/clipboard', () => ({
    setString: vi.fn(),
}))

vi.mock('../toast', () => ({
    __esModule: true,
    default: vi.fn(() => ({
        showToast: vi.fn(),
    })),
}))

vi.mock('@hooks/language', () => ({
    useLanguage: vi.fn(() => ({
        t: (key: string) => key,
    })),
}))

describe('useClipboard', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('should copy text to clipboard and show toast', () => {
        const mockShowToast = vi.fn()
        ;(useToast as vi.Mock).mockReturnValue({
            showToast: mockShowToast,
        })

        const { result } = renderHook(() => useClipboard())

        act(() => {
            result.current.copyToClipboard('test text')
        })

        expect(Clipboard.setString).toHaveBeenCalledWith('test text')
        expect(mockShowToast).toHaveBeenCalledWith({
            title: 'common.copied_to_clipboard.title',
            body: 'common.copied_to_clipboard.body',
            type: 'success',
        })
    })
})
