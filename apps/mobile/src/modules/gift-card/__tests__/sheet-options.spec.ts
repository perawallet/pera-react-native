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
import { BIDALI_SHEET_OPTIONS } from '../sheet-options'

describe('BIDALI_SHEET_OPTIONS', () => {
    // Every Bidali opener shares this object, so asserting it here covers all
    // of them. Bidali is a WebView: avoiding the keyboard on top of the inset
    // the page already applies shifts it twice.
    it('opts out of sheet keyboard avoidance', () => {
        expect(BIDALI_SHEET_OPTIONS.avoidKeyboard).toBe(false)
    })
})
