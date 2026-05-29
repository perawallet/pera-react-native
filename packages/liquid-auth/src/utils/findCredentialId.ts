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

import type { LiquidAuthCredentialRecord } from '../models'

/**
 * Finds the credentialId of a previously-registered passkey for this
 * host+address, so a reconnect asserts (reuses) the existing passkey instead of
 * attesting a fresh one. Reads the durable credential registry (not sessions),
 * so it survives session disconnect/expiry. Returns undefined when none is
 * recorded (first connect for the host/account).
 */
export const findCredentialId = (
    credentials: LiquidAuthCredentialRecord[],
    host: string,
    address: string,
): string | undefined =>
    credentials.find(
        credential =>
            credential.host === host && credential.address === address,
    )?.credentialId
