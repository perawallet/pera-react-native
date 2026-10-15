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

import type { E2eFixtureDeeplinkHandler } from './useE2eFixtureDeeplink'

// No store or navigation import: outside an E2E bundle nothing that can rewrite
// wallet state is reachable from here.
const noopHandler: E2eFixtureDeeplinkHandler = () => {}

export const useE2eFixtureDeeplink = (): E2eFixtureDeeplinkHandler =>
    noopHandler
