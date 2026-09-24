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

import { initDecimalConfig } from '@perawallet/wallet-core-shared'
import { initNetworkStatus } from '@modules/network'
import { registerAppBottomSheets } from './bottom-sheet-registrations'
import { updateQueryHeaders } from './query-headers'

/**
 * The web shell's counterpart to preReact.ts. Store-bearing, so App.web.tsx
 * reaches it only through its post-hydration dynamic import and calls it just
 * before mounting AppShell (BOOT-ORDER CONTRACT); it must never enter
 * App.web.tsx's static graph.
 */
export const initRuntime = (): void => {
    initDecimalConfig()
    registerAppBottomSheets()
    // Needs getProvider().deviceInfo, which only resolves after hydration.
    updateQueryHeaders()
    // Without this there is no onlineManager binding and every query treats
    // the app as online.
    void initNetworkStatus()
}
