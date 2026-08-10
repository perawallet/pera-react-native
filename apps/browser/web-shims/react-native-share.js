/*
 Copyright 2022-2025 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
 */

// Web shim for react-native-share. The real package calls
// TurboModuleRegistry.getEnforcing('RNShare') at module-eval time, which
// throws (undefined.getEnforcing) in browser environments. `@utils/shareText`
// and `@utils/shareCsvFile` are the only two call sites in this codebase and
// both use only `Share.open(...)`, awaited inside a try/catch that already
// surfaces the error to the user (see useAccountHistory.tsx) — so this shim
// prefers the real Web Share API when available and otherwise fails loud
// with a clear error, rather than silently no-op'ing a user-initiated share.
const open = async options => {
    if (typeof navigator !== 'undefined' && navigator.share) {
        await navigator.share({
            title: options?.title,
            text: options?.message,
            url: options?.url,
        })
        return { success: true, message: 'shared' }
    }
    throw new Error('Sharing is not supported in this browser context.')
}

const Share = { open }

export default Share
