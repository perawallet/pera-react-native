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

import { registerLocaleTourRunner } from './registry'
import { runTour } from './utils/runTour'
import { runTourStep } from './utils/runTourStep'

/**
 * Side-effect module, imported once from App.tsx and nowhere else.
 *
 * This is the only place the tour driver is pulled into the graph, which is
 * what keeps it out of the deeplink handler's imports (see registry.ts) and
 * makes it the single module metro.config.js has to swap to detach the driver.
 * App.tsx is a safe import site precisely because nothing in the gallery
 * catalog imports back up to it.
 */
registerLocaleTourRunner({ runTour, runTourStep })
