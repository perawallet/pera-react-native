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

// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { backupWebSocketUrl } from '../webSocketUrl'

describe('backupWebSocketUrl', () => {
    it('swaps https→wss, keeps backupId raw in the path, and url-encodes query params', () => {
        const url = backupWebSocketUrl({
            baseUrl: 'https://staging.backup.perawallet.app/',
            backupId: 'did:pera:ABC',
            deviceId: 'dev-1',
            timestamp: '2026-06-25T00:00:00.000Z',
            signature: 'aa+bb/cc==',
        })
        expect(
            url.startsWith(
                'wss://staging.backup.perawallet.app/api/v3/backup/did:pera:ABC?',
            ),
        ).toBe(true)
        expect(url).toContain('signature=aa%2Bbb%2Fcc%3D%3D')
        expect(url).toContain('device_id=dev-1')
        expect(url).toContain('ts=2026-06-25T00%3A00%3A00.000Z')
    })

    it('swaps http→ws for a local base url', () => {
        const url = backupWebSocketUrl({
            baseUrl: 'http://localhost:3000',
            backupId: 'b',
            deviceId: 'd',
            timestamp: 't',
            signature: 's',
        })
        expect(url.startsWith('ws://localhost:3000/api/v3/backup/b?')).toBe(
            true,
        )
    })
})
