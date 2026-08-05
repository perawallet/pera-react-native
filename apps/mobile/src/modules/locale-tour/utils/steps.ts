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

import {
    getScreenSections,
    getSheetSections,
    getDialogSections,
    getComponentSections,
    getSharedComponentSections,
    getModuleComponentSections,
} from '@modules/settings/screens/developer/gallery-catalog'

import type { GallerySection } from '@modules/settings/screens/developer/gallery-catalog/types'

import type { TourCategory, TourStep } from '../types'

const stepsFrom = (
    sections: GallerySection[],
    category: TourCategory,
): TourStep[] =>
    sections.flatMap(section =>
        section.items
            // An action entry runs a callback (e.g. seeding mock state) and
            // renders no surface of its own — screenshotting it just
            // photographs whatever was already on screen before it ran, and
            // every action entry in the default catalogs is labelled "(needs
            // live state)" for exactly that reason.
            .filter(entry => entry.launch.kind !== 'action')
            .map(entry => ({
                id: entry.id,
                label: entry.label,
                category,
                entry,
            })),
    )

// Record<TourCategory, ...> so adding a category is a compile error here
// until it gets a getter — the same exhaustiveness that ALL_CATEGORIES below
// leans on instead of hand-maintaining a second list.
const bySection: Record<TourCategory, () => GallerySection[]> = {
    screens: getScreenSections,
    sheets: getSheetSections,
    dialogs: getDialogSections,
    components: getComponentSections,
    'shared-components': getSharedComponentSections,
    'module-components': getModuleComponentSections,
}

// Screens, sheets and dialogs render in real layout context, which is what
// makes a screenshot meaningful for "does this translated string fit". The
// component categories render one component into a synthetic preview harness,
// so they are available behind an explicit opt-in rather than in the default
// run — 166 extra captures per device per locale is a lot of images to review
// for weaker signal.
export const getTourSteps = (
    categories: TourCategory[] = ['screens', 'sheets', 'dialogs'],
): TourStep[] =>
    categories.flatMap(category => stepsFrom(bySection[category](), category))

// Derived from bySection's keys, not hand-maintained, so a category can only
// be registered in one place — bySection's Record type forces every new
// TourCategory to get an entry, and this list picks that up for free.
const ALL_CATEGORIES = Object.keys(bySection) as TourCategory[]

// Selection and resolution are different concerns: getTourSteps picks which
// steps a run drives, but getTourStep must resolve any id a deeplink hands
// it regardless of that run's scope, so it always searches every category.
// Safe only because the catalogs are static per process — if a catalog ever
// became dynamic (feature flags, A/B-varied previews), this cache would keep
// serving whatever existed at the first call.
let stepsById: Map<string, TourStep> | undefined

export const getTourStep = (id: string): TourStep | undefined => {
    if (!stepsById) {
        stepsById = new Map(
            getTourSteps(ALL_CATEGORIES).map(step => [step.id, step]),
        )
    }
    return stepsById.get(id)
}
