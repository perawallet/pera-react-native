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

/** Steps the extension popup hands off to its expanded tab. */
export type TabHandoffFlow = 'backup-restore-scan' | 'backup-setup'

export type UseTabHandoffResult = {
    /** Always false off-web: native has no popup surface to escape. */
    shouldHandOff: boolean
    openTab: () => Promise<void>
}

const openTab = async (): Promise<void> => {}

// Native no-op; see the `.web.ts` twin.
export const useTabHandoff = (_flow: TabHandoffFlow): UseTabHandoffResult => ({
    shouldHandOff: false,
    openTab,
})
