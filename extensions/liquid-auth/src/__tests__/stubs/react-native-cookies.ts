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

// Inert stub for the native @react-native-cookies/cookies module so the
// extension's tests can import sessionCookie.ts (which imports the default
// export) without the native module. Tests that exercise cookie-extraction
// logic inject their own CookieReader; this just satisfies the import.
export default {
    get: async () => ({}),
    set: async () => true,
    clearAll: async () => true,
}
