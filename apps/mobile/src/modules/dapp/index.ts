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

// Web-only module (the ARC-0027 approval popup is a browser-extension
// surface with no native counterpart) — explicit `.web` on the routes import
// mirrors AppShell.web.tsx's own `./AppShell.web` convention for a file with
// no native twin.
export { DappRequestRoutes } from './routes/DappRequestRoutes.web'
export { useDappRequest } from './hooks/useDappRequest'
export { EnableRequestScreen } from './screens/EnableRequestScreen'
export { SignRequestApprovalScreen } from './screens/SignRequestApprovalScreen'
