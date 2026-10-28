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

import type { Nullable } from '@perawallet/wallet-core-shared'

// The onboarding password for the post-KYC login lives here rather than in the
// card store, so no store subscriber, devtools or serialiser can read it. The
// store only mirrors whether one is held. Not exported from the package.
let loginPassword: Nullable<string> = null

export const setLoginPassword = (password: Nullable<string>): void => {
    loginPassword = password
}

export const getLoginPassword = (): Nullable<string> => loginPassword
