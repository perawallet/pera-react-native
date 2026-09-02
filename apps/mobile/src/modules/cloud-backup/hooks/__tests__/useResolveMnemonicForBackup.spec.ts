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

import { describe, expect, it, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import type { Algo25Account } from '@perawallet/wallet-core-accounts'

const { executeWithMnemonicMock, loggerWarnMock } = vi.hoisted(() => ({
    executeWithMnemonicMock: vi.fn(),
    loggerWarnMock: vi.fn(),
}))

vi.mock('@perawallet/wallet-core-shared', () => ({
    logger: { warn: loggerWarnMock },
}))

vi.mock('@perawallet/wallet-core-kms', () => ({
    BACKUP_ACCESS_DOMAIN: 'backup-flow',
    mnemonicIndexToWord: (index: number) => `word${index}`,
    useKMS: () => ({ executeWithMnemonic: executeWithMnemonicMock }),
}))

import { useResolveMnemonicForBackup } from '../useResolveMnemonicForBackup'

const ACCOUNT = {
    id: 'a-1',
    type: 'algo25',
    address: 'ADDR',
    keyPairId: 'key-1',
    name: 'Algo25',
} as unknown as Algo25Account

describe('useResolveMnemonicForBackup', () => {
    beforeEach(() => {
        executeWithMnemonicMock.mockReset()
        loggerWarnMock.mockReset()
    })

    it('joins the wordlist indices the KMS session hands over', async () => {
        executeWithMnemonicMock.mockImplementation(
            async (
                _keyId: string,
                _domain: string,
                handler: (indices: Uint16Array) => string,
            ) => handler(new Uint16Array([1, 2, 3])),
        )

        const { result } = renderHook(() => useResolveMnemonicForBackup())

        await expect(result.current(ACCOUNT)).resolves.toBe('word1 word2 word3')
        expect(executeWithMnemonicMock).toHaveBeenCalledWith(
            'key-1',
            'backup-flow',
            expect.any(Function),
        )
    })

    it('resolves null when the key is unreadable, so the account is skipped rather than backed up without its secret', async () => {
        executeWithMnemonicMock.mockRejectedValue(new Error('no access'))

        const { result } = renderHook(() => useResolveMnemonicForBackup())

        await expect(result.current(ACCOUNT)).resolves.toBeNull()
        expect(loggerWarnMock).toHaveBeenCalled()
    })
})
