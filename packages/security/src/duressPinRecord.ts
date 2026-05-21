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

// Thin re-export aliases over `pinRecord.ts`. Duress and regular PIN records
// share an identical on-disk shape (same PBKDF2 params, same JSON encoding)
// and only differ in which KMS key id they're stored under. The duress record
// reuses the failedAttempts / lockoutEndTime fields with their initial values
// — they're not consulted on the duress path, but keeping the shape identical
// means the PBKDF2 / verification primitives are not duplicated.
export {
    type PinRecord as DuressPinRecord,
    createPinRecord as createDuressPinRecord,
    parsePinRecord as parseDuressPinRecord,
    serializePinRecord as serializeDuressPinRecord,
    verifyPinAgainstRecord as verifyPinAgainstDuressRecord,
} from './pinRecord'
