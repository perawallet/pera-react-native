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

// True only while the PIN screen is up, not during the foreground check that
// precedes it (see useIsLockOverlayVisible for that wider window). Lives here
// for the same reason useIsLockOverlayVisible does.
const AppLockedContext = createContext(false)

export const AppLockedProvider = AppLockedContext.Provider

export const useIsAppLocked = (): boolean => useContext(AppLockedContext)
