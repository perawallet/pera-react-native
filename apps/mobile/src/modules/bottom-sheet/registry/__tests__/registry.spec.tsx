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

import {
    registerBottomSheet,
    getRegisteredBottomSheet,
    clearBottomSheetRegistryForTests,
} from '../registry'

const FakeSheet = ({ label }: { label: string }) => (
    <span data-testid='fake'>{label}</span>
)

describe('bottom-sheet registry', () => {
    beforeEach(() => {
        clearBottomSheetRegistryForTests()
    })

    it('returns undefined for an unregistered type', () => {
        expect(getRegisteredBottomSheet('missing')).toBeUndefined()
    })

    it('round-trips a registration', () => {
        registerBottomSheet('fake' as never, FakeSheet as never)
        expect(getRegisteredBottomSheet('fake')).toBe(FakeSheet)
    })

    it('a second registration overrides the first', () => {
        const OtherSheet = () => <span>other</span>
        registerBottomSheet('fake' as never, FakeSheet as never)
        registerBottomSheet('fake' as never, OtherSheet as never)
        expect(getRegisteredBottomSheet('fake')).toBe(OtherSheet)
    })
})
