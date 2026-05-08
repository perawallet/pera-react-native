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

// No-op stub for the Ledger BLE / USB extensions. The real packages depend
// on `react-native-ble-plx` and Ledger native transports that don't load
// under jsdom + react-native-web. Onboarding/send tests don't exercise
// hardware-wallet flows so a no-op extension is safe; tests that DO need
// Ledger would override at the test level.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const WithLedgerExtension = (_provider: any): Record<string, never> => {
    return {}
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const WithLedgerUsbExtension = (_provider: any): Record<string, never> => {
    return {}
}
