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

import type { TabResumeIntent } from './tabResumeIntentTypes'

export type { TabResumeIntent }

// Memory-only and per page: set while a flow is signing, so "Open in Tab" on a
// signing error knows what to reopen. Flows clear it once signing settles, or
// a later, unrelated error would resume a finished flow.
let current: TabResumeIntent | null = null

export const registerTabResumeIntent = (intent: TabResumeIntent): void => {
    current = intent
}

export const clearTabResumeIntent = (): void => {
    current = null
}

export const peekTabResumeIntent = (): TabResumeIntent | null => current
