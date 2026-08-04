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

import type { LocaleTourDeeplinkHandler } from '@modules/locale-tour/types'

// This file contains no `import('@modules/locale-tour')`, and that absence is
// the whole mechanism: Metro bundles a dynamic import as a real graph edge, so
// the tour driver (and with it every screen the gallery catalog can launch) is
// excluded by having no importer at all rather than by an unreachable branch.
const noopHandler: LocaleTourDeeplinkHandler = async () => {}

export const useLocaleTourDeeplink = (): LocaleTourDeeplinkHandler =>
    noopHandler
