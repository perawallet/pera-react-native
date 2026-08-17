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

import { createContext, useContext } from 'react'

// AutoLockGuard owns the Provider; this lives outside @modules/security because
// @components/core consumes it (PWDropdown), and reaching it through the
// security barrel would drag @perawallet/wallet-core-security — a persisted
// store that hydrates at module eval — into core's graph.
const IS_LOCK_OVERLAY_VISIBLE_OUTSIDE_GUARD = false

const LockOverlayContext = createContext(IS_LOCK_OVERLAY_VISIBLE_OUTSIDE_GUARD)

export const LockOverlayProvider = LockOverlayContext.Provider

export const useIsLockOverlayVisible = (): boolean =>
    useContext(LockOverlayContext)
