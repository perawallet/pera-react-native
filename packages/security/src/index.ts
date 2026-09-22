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

export const name = '@perawallet/wallet-core-security'

export * from './constants'
export * from './models'
export * from './hooks'
// The comparisons stay internal: `usePinCode().verifyPin` is the only way in,
// so no caller can test a PIN without the attempt being charged.
export {
    PIN_RECORD_VERSION,
    type PinRecord,
    applyDuressPin,
    constantTimeEqual,
    createEmptyDuressSlot,
    createPinRecord,
    parsePinRecord,
    serializePinRecord,
} from './pinRecord'
export * from './pinRecordMigration'
export * from './biometricBlob'
export * from './store'
