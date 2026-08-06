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

import type {
    RunTourParams,
    RunTourStepOutcome,
    RunTourStepParams,
} from './types'

/**
 * Deliberately a leaf: types only, no value imports, and nothing from the
 * gallery catalog.
 *
 * The deeplink handler used to reach the tour directly, which closed a cycle —
 * handler -> tour -> gallery catalog -> app components -> useDeepLink -> the
 * deeplink handler barrel. The tour must see every surface to drive it, and
 * app components must see useDeepLink, so neither of those edges can go. This
 * module breaks the loop instead: the handler depends on this file, and the
 * tour pushes itself in from register.ts. A dynamic `import()` would not have
 * helped — fallow counts it as a graph edge like any other.
 */
export type LocaleTourRunner = {
    runTour: (params: RunTourParams) => Promise<void>
    runTourStep: (params: RunTourStepParams) => Promise<RunTourStepOutcome>
}

let runner: LocaleTourRunner | undefined

export const registerLocaleTourRunner = (next: LocaleTourRunner): void => {
    runner = next
}

/**
 * `undefined` in any build where register.ts resolved to its stub — i.e. every
 * non-dev bundle. Callers treat that as "no tour here" rather than an error.
 */
export const getLocaleTourRunner = (): LocaleTourRunner | undefined => runner
