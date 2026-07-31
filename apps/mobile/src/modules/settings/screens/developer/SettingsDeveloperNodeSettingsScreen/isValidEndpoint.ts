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

/**
 * Platform-neutral on purpose: this file has no `.web` twin, unlike
 * `useSettingsDeveloperNodeSettingsScreen(.web).ts`. A bare import of THAT
 * pair resolves to whichever platform variant Metro/webpack pick for the
 * importing bundle, which is exactly why `isValidEndpoint` used to be
 * duplicated three times (once per file that needed it) instead of shared
 * via a cross-import between the two screen-hook variants. Importing this
 * module instead is unambiguous on every platform.
 */
export const isValidEndpoint = (value: string): boolean => {
    try {
        const { protocol } = new URL(value)
        return protocol === 'http:' || protocol === 'https:'
    } catch {
        return false
    }
}
