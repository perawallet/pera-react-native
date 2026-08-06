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

// The tour driver's only entry point. Reaching past it (importing utils/runTour
// or utils/steps directly) re-attaches the driver to builds metro.config.js
// means to exclude it from — see index.stub.ts. The gallery catalog it reads is
// a separate matter: that already ships in release builds via the developer
// settings screens, and this swap does not change that.
export { runTour } from './utils/runTour'
export { runTourStep } from './utils/runTourStep'
export { getTourSteps } from './utils/steps'

export type {
    RunTourParams,
    RunTourStepOutcome,
    RunTourStepParams,
    TourCategory,
    TourStep,
} from './types'
