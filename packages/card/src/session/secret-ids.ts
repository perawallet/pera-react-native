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

// KMS keystore ids for the Baanx tokens. The tokens live ONLY in the encrypted
// keystore; they are read on demand via `withSecret` at the point of use.
export const ACCESS_TOKEN_SECRET_ID = 'baanx-access-token'
export const REFRESH_TOKEN_SECRET_ID = 'baanx-refresh-token'
