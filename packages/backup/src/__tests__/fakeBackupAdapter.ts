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

import { vi } from 'vitest'
import type { BackupChainAdapter } from '../chain-adapter'

export const fakeBackupAdapter = (
    overrides: Partial<BackupChainAdapter> = {},
): BackupChainAdapter => ({
    chainId: 'algorand',
    seedReference: vi.fn(async (_kms, seedKeyId: string) => `REF-${seedKeyId}`),
    deriveHdAccount: vi.fn(async (_kms, seedKeyId, details) => ({
        keyPairId: `${seedKeyId}/${details.account}/${details.keyIndex}/${details.derivationType}`,
        publicKey: new Uint8Array([details.account, details.keyIndex]),
        address: `ADDR-${details.account}-${details.keyIndex}`,
    })),
    useImportFromSeed: vi.fn(() => vi.fn()),
    secureBackup: {
        parseEnvelope: vi.fn(),
        decryptPayload: vi.fn(),
        partitionImportable: vi.fn(),
        useImportAccount: vi.fn(() => vi.fn()),
    },
    ...overrides,
})
