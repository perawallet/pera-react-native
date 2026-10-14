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

// ARC-35 envelope: the outer JSON that lives inside the base64-encoded
// backup file. The whole file is `base64(JSON.stringify(envelope))`.
export const ASB_BACKUP_PROTOCOL_VERSION = '1.0'
export const ASB_BACKUP_CIPHER_SUITE = 'HMAC-SHA256:sodium_secretbox_easy'

export const ASB_RECOVERY_MNEMONIC_WORD_COUNT = 12
