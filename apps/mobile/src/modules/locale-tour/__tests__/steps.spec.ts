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
import { getTourSteps, getTourStep } from '../utils/steps'
import type { TourCategory } from '../types'

describe('getTourSteps', () => {
    it('defaults to the full-layout categories', () => {
        const categories = new Set(getTourSteps().map(step => step.category))

        expect([...categories].sort()).toEqual(['dialogs', 'screens', 'sheets'])
    })

    it('is far broader than the 75-step hand-maintained tour it replaces', () => {
        expect(getTourSteps().length).toBeGreaterThan(100)
    })

    it('never includes an action-kind entry, since it runs a callback and renders no surface of its own', () => {
        const allCategories: TourCategory[] = [
            'screens',
            'sheets',
            'dialogs',
            'components',
            'shared-components',
            'module-components',
        ]

        for (const categories of [
            undefined,
            allCategories,
            ...allCategories.map(category => [category]),
        ]) {
            const steps = getTourSteps(categories)
            expect(
                steps.every(step => step.entry.launch.kind !== 'action'),
            ).toBe(true)
        }
    })

    it('yields unique ids, since screenshots are keyed by id', () => {
        const ids = getTourSteps().map(step => step.id)

        expect(new Set(ids).size).toBe(ids.length)
    })

    it('never includes tools, which are actions rather than surfaces', () => {
        const ids = getTourSteps([
            'screens',
            'sheets',
            'dialogs',
            'components',
            'shared-components',
            'module-components',
        ]).map(step => step.id)

        expect(ids.some(id => id.startsWith('tool-'))).toBe(false)
    })

    it('can opt into the component categories, and ids stay unique', () => {
        const steps = getTourSteps([
            'screens',
            'sheets',
            'dialogs',
            'components',
            'shared-components',
            'module-components',
        ])
        const ids = steps.map(step => step.id)

        // A raw count alone would still pass with an entire sub-catalog
        // silently missing, so require every requested category to have
        // actually produced steps.
        const categories = new Set(steps.map(step => step.category))
        expect([...categories].sort()).toEqual([
            'components',
            'dialogs',
            'module-components',
            'screens',
            'shared-components',
            'sheets',
        ])
        expect(steps.length).toBeGreaterThan(200)
        expect(new Set(ids).size).toBe(ids.length)
    })
})

describe('getTourStep', () => {
    it('resolves a known id', () => {
        const first = getTourSteps()[0]

        expect(getTourStep(first.id)).toEqual(first)
    })

    it('resolves an id from a category outside the default scope', () => {
        // A component-catalog id: opt-in for getTourSteps, but resolution
        // must not depend on which categories a given tour run selected.
        expect(getTourStep('comp-pw-button')?.category).toBe('components')
    })

    it('resolves a shared-component id, outside the default scope', () => {
        expect(getTourStep('comp-contact-avatar')?.category).toBe(
            'shared-components',
        )
    })

    it('resolves a module-component id, outside the default scope', () => {
        expect(getTourStep('comp-account-display')?.category).toBe(
            'module-components',
        )
    })

    it('returns undefined for an unknown id', () => {
        expect(getTourStep('scr-does-not-exist')).toBeUndefined()
    })
})
