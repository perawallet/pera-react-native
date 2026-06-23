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

import { encodeAlgorandAddress } from '@perawallet/wallet-core-blockchain'
import type { BackupId } from '../models'
import { BACKUP_ID_PREFIX } from './constants'

/**
 * Derives the DID-compatible `backupId` from the auth public key:
 * `did:pera:<algorand address>`. The identifier is the standard Algorand
 * address of the auth public key (base32 of `pubkey || sha512_256(pubkey)[-4:]`)
 * — the backend decodes it back to the public key to verify the registration
 * proof.
 */
export const deriveBackupId = (authPublicKey: Uint8Array): BackupId =>
    `${BACKUP_ID_PREFIX}${encodeAlgorandAddress(authPublicKey)}`
