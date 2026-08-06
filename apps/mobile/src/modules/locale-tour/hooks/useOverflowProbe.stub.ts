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

import type { OverflowProbe } from '../types'

// One frozen module-level object, returned as-is on every call. PWText renders
// on every screen many times over, so this must allocate nothing per render:
// no refs, no effects, and no fresh object or closures. Both handlers being
// absent is what makes React attach no listeners at all.
const NO_PROBE: OverflowProbe = Object.freeze({})

export const useOverflowProbe = (): OverflowProbe => NO_PROBE
