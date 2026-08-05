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

import type { LayoutChangeEvent, TextLayoutEvent } from 'react-native'

import type { GalleryEntry } from '@modules/settings/screens/developer/gallery-catalog/types'

// Types only, no values: every `*.stub.ts` in this tour imports from here so
// the swap metro.config.js performs is checkable against one declaration
// rather than against whichever module happened to resolve.

export type TourCategory =
    | 'screens'
    | 'sheets'
    | 'dialogs'
    | 'components'
    | 'shared-components'
    | 'module-components'

export type TourStep = {
    id: string
    label: string
    category: TourCategory
    entry: GalleryEntry
}

export type RunTourParams = {
    locale: string
    categories?: TourCategory[]
}

export type RunTourStepParams = {
    stepId: string
    locale: string
}

// Lets runTour distinguish "this step failed" from "navigation itself is
// gone" without parsing its own console.log output — the marker text is for
// the external driver, this return value is for the in-process caller.
export type RunTourStepOutcome =
    | 'shot'
    | 'unknown-step'
    | 'launch-error'
    | 'navigation-not-ready'
    | 'sheet-not-mounted'

/**
 * Dispatches an already-parsed locale-tour deeplink. Lives here rather than
 * next to the handler so the handler's stub doesn't have to reference the
 * real module it replaces.
 */
export type LocaleTourDeeplinkHandler = (params: {
    locale: string
    step?: string
    run?: 'all'
}) => Promise<void>

export type UseOverflowProbeParams = {
    children: React.ReactNode
    testID?: string
    /** Already resolved by PWText (`truncate` collapses to 1). */
    numberOfLines: number | undefined
}

/** Layout handlers PWText spreads onto the underlying Text. */
export type OverflowProbe = {
    onLayout?: (event: LayoutChangeEvent) => void
    onTextLayout?: (event: TextLayoutEvent) => void
}

/** i18next `resources` fragment — empty when the tour is stubbed out. */
export type PseudoResources = Record<
    string,
    { translation: Record<string, unknown> }
>
