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

import type { RunTourStepOutcome, TourStep } from './types'

// Belt-and-braces. The tour's only caller (the locale-tour deeplink handler)
// is itself swapped for a stub in the same builds this file serves, so
// nothing should reach the barrel here at all — but if something ever does,
// it gets these no-ops instead of pulling the driver back into the graph.

const NO_STEPS: TourStep[] = []

export const runTour = async (): Promise<void> => {}

export const runTourStep = async (): Promise<RunTourStepOutcome> =>
    'unknown-step'

export const getTourSteps = (): TourStep[] => NO_STEPS

export type {
    RunTourParams,
    RunTourStepOutcome,
    RunTourStepParams,
    TourCategory,
    TourStep,
} from './types'
