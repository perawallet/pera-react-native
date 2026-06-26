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

import { describe, expect, it } from 'vitest'
import { mergeAssociatedDomains } from '../withProductionAssociatedDomains'

describe('mergeAssociatedDomains', () => {
    it('adds the production applinks onto the autofill webcredentials entry', () => {
        expect(
            mergeAssociatedDomains(['webcredentials:perawallet.app']),
        ).toEqual([
            'webcredentials:perawallet.app',
            'applinks:perawallet.app',
            'applinks:perawallet',
        ])
    })

    it('produces both applinks when nothing exists yet', () => {
        expect(mergeAssociatedDomains([])).toEqual([
            'applinks:perawallet.app',
            'applinks:perawallet',
        ])
        expect(mergeAssociatedDomains(undefined)).toEqual([
            'applinks:perawallet.app',
            'applinks:perawallet',
        ])
    })

    it('is idempotent — never duplicates an already-present domain', () => {
        const full = [
            'applinks:perawallet.app',
            'applinks:perawallet',
            'webcredentials:perawallet.app',
        ]
        expect(mergeAssociatedDomains(full)).toEqual(full)
    })
})
