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

// @react-native-cookies/cookies is a native module that can't load under
// jsdom/vitest. The Liquid Auth session-cookie reader imports its default
// export (CookieManager), so it enters the graph once that code is exercised.
// Liquid Auth tests inject their own CookieManager where they need behavior,
// so an inert stub matching the module's default-export shape suffices here.
export default {
    get: async () => ({}),
    set: async () => true,
    clearAll: async () => undefined,
}
