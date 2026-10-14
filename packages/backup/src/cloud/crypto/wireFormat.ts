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

import { sha512_256 } from '@noble/hashes/sha2.js'
import { concatBytes } from '@noble/hashes/utils.js'
import { base32nopad } from '@scure/base'
import type { BackupId } from '../models'
import { BACKUP_ID_PREFIX } from './constants'

// Frozen backend format: the backend verifies the register proof as an Algorand signBytes message.
export const BACKUP_PROOF_PREFIX = 'MX'

// Frozen backend format: `did:pera:` + the Algorand address of the auth public key, which the backend decodes back to verify the proof.
export const encodeBackupId = (authPublicKey: Uint8Array): BackupId =>
    `${BACKUP_ID_PREFIX}${base32nopad.encode(
        concatBytes(authPublicKey, sha512_256(authPublicKey).slice(-4)),
    )}`
