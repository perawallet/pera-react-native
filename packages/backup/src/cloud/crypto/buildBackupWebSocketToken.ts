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

import nacl from 'tweetnacl'
import { encodeToBase64 } from '@perawallet/wallet-core-shared'

export const WS_MESSAGE_PREFIX = 'WS'

type BuildWsTokenParams = {
    backupId: string
    deviceId: string
    /** ISO-8601 UTC timestamp; must be within the server's ±5min skew window. */
    timestamp: string
    authSecretKey: Uint8Array
}

/** Canonical message the server re-derives and verifies: `WS|backupId|deviceId|ts`. */
export const buildBackupWebSocketMessage = (
    backupId: string,
    deviceId: string,
    timestamp: string,
): string => `${WS_MESSAGE_PREFIX}|${backupId}|${deviceId}|${timestamp}`

/** Ed25519-sign the WS message with the backup auth key; returns standard base64
 *  of the 64-byte signature (URL-encode it before placing in the query string). */
export const buildBackupWebSocketToken = ({
    backupId,
    deviceId,
    timestamp,
    authSecretKey,
}: BuildWsTokenParams): string => {
    const message = buildBackupWebSocketMessage(backupId, deviceId, timestamp)
    const signature = nacl.sign.detached(new TextEncoder().encode(message), authSecretKey)
    return encodeToBase64(signature)
}
