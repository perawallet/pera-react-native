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

type BackupWsUrlParams = {
    baseUrl: string
    backupId: string
    deviceId: string
    timestamp: string
    /** Standard base64 signature; this function URL-encodes it. */
    signature: string
}

/** Build the WS connect URL. `backupId` stays RAW in the path (matches the
 *  server route `/:backupId` and the Android client). Query params are encoded
 *  via URLSearchParams (handles the signature's +,/,= and the ts colons). */
export const backupWebSocketUrl = ({
    baseUrl,
    backupId,
    deviceId,
    timestamp,
    signature,
}: BackupWsUrlParams): string => {
    const wsBase = baseUrl
        .replace(/^http:\/\//, 'ws://')
        .replace(/^https:\/\//, 'wss://')
        .replace(/\/+$/, '')
    const query = new URLSearchParams({
        device_id: deviceId,
        ts: timestamp,
        signature,
    }).toString()
    return `${wsBase}/api/v3/backup/${backupId}?${query}`
}
