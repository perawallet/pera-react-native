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

// One string, two consumers: the config plugin writes it into the app manifest
// and entry.native.js registers the picker under it. Keeping them as separate
// literals is not a survivable mistake — React Native throws "has not been
// registered" on its own thread, and the process dies well before the picker
// activity's watchdog can fall back to the error view. Verified on device:
// a mismatched name crashes the wallet, it does not fail closed.
//
// CommonJS because app.config.builder.js is loaded by Node, not by Metro.
module.exports = 'PeraAutofillPicker'
