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

export { ConnectionsProvider } from './ConnectionsProvider'
export type { ConnectionsProviderProps } from './ConnectionsProvider'
// From the context module, so that a consumer importing it BY PATH keeps the
// v1 handler, the migration and the approval sheets out of its graph. This
// barrel also exports `ConnectionsProvider`, so importing through it pulls
// them in regardless.
export {
    useConnectionRegistry,
    useOptionalConnectionRegistry,
} from './connectionRegistryContext'
