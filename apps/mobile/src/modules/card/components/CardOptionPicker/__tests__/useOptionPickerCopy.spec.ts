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

import { describe, it, expect } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useOptionPickerCopy } from '../useOptionPickerCopy'

describe('useOptionPickerCopy', () => {
    it('maps each picker string to its own field', () => {
        const { result } = renderHook(() => useOptionPickerCopy())

        expect(result.current).toEqual({
            searchPlaceholder: 'peraCard.option_picker.search_placeholder',
            emptyTitle: 'peraCard.option_picker.empty_title',
            emptyBody: 'peraCard.option_picker.empty_body',
            errorTitle: 'peraCard.option_picker.error_title',
            errorBody: 'peraCard.option_picker.error_body',
            retry: 'peraCard.option_picker.retry',
        })
    })
})
