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
 * Registers nothing, so `getLocaleTourRunner()` stays `undefined` and the
 * deeplink handler no-ops. Nothing else imports the tour driver, so this empty
 * module is what actually keeps runTour/runTourStep/steps — and the gallery
 * catalog traversal they perform — out of non-dev bundles.
 *
 * Intentionally has no exports: App.tsx imports it for effect only.
 */
export {}
