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

// Only the E2E fixture parser and handler import this, and both are swapped for
// stubs outside an E2E bundle, so the list never reaches a production build.
// e2e/stress-tiers.json sizes its contact tiers from these counts.
export const E2E_STRESS_CONTACT_COUNTS = [50, 250, 500, 1000] as const

export type E2eStressContactCount = (typeof E2E_STRESS_CONTACT_COUNTS)[number]
