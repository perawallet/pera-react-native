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

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook } from '@testing-library/react'

const { exportSecp256k1KeyMock, loggerWarnMock } = vi.hoisted(() => ({
    exportSecp256k1KeyMock: vi.fn(),
    loggerWarnMock: vi.fn(),
}))

vi.mock('@perawallet/wallet-core-shared', async importOriginal => ({
    ...(await importOriginal<
        typeof import('@perawallet/wallet-core-shared')
    >()),
    logger: { warn: loggerWarnMock, debug: vi.fn() },
}))

vi.mock('@perawallet/wallet-core-kms', async importOriginal => ({
    ...(await importOriginal<typeof import('@perawallet/wallet-core-kms')>()),
    useKMS: () => ({ exportSecp256k1Key: exportSecp256k1KeyMock }),
}))

import {
    accountsChainAdapters,
    type AccountsChainAdapter,
} from '@perawallet/wallet-core-accounts'
import { revealEthereumPrivateKey } from '@perawallet/wallet-core-chain-ethereum'
import { BACKUP_ACCESS_DOMAIN, hexToBytes } from '@perawallet/wallet-core-kms'
import {
    HARDHAT_0_KEY_HEX,
    ethereumAccountsAdapter,
} from '../../../__tests__/backupChainFixtures'
import { useResolvePrivateKeyForBackup } from '../useResolvePrivateKeyForBackup'

const register = (adapter: Partial<AccountsChainAdapter>) => {
    accountsChainAdapters.reset()
    accountsChainAdapters.register({
        ...ethereumAccountsAdapter,
        ...adapter,
    } as AccountsChainAdapter)
}

describe('useResolvePrivateKeyForBackup', () => {
    beforeEach(() => {
        exportSecp256k1KeyMock
            .mockReset()
            .mockImplementation(async () => hexToBytes(HARDHAT_0_KEY_HEX))
        loggerWarnMock.mockReset()
        register({ revealPrivateKey: revealEthereumPrivateKey })
    })

    it('reads the key through the chain adapter, in the backup access domain', async () => {
        const { result } = renderHook(() => useResolvePrivateKeyForBackup())

        const key = await result.current('ethereum', 'raw-key')

        expect(exportSecp256k1KeyMock).toHaveBeenCalledWith(
            'raw-key',
            BACKUP_ACCESS_DOMAIN,
        )
        expect(key).toEqual(hexToBytes(HARDHAT_0_KEY_HEX))
    })

    it('resolves null for a chain with no accounts adapter', async () => {
        accountsChainAdapters.reset()
        const { result } = renderHook(() => useResolvePrivateKeyForBackup())

        expect(await result.current('ethereum', 'raw-key')).toBeNull()
        expect(exportSecp256k1KeyMock).not.toHaveBeenCalled()
    })

    it('resolves null when the adapter has no revealPrivateKey', async () => {
        register({ revealPrivateKey: undefined })
        const { result } = renderHook(() => useResolvePrivateKeyForBackup())

        expect(await result.current('ethereum', 'raw-key')).toBeNull()
        expect(exportSecp256k1KeyMock).not.toHaveBeenCalled()
    })

    it('resolves null and logs only the message when the keystore refuses', async () => {
        exportSecp256k1KeyMock.mockRejectedValue(new Error('keystore locked'))
        const { result } = renderHook(() => useResolvePrivateKeyForBackup())

        expect(await result.current('ethereum', 'raw-key')).toBeNull()

        expect(loggerWarnMock).toHaveBeenCalledWith(
            'useResolvePrivateKeyForBackup: resolve failed',
            { error: 'keystore locked' },
        )
        const logged = JSON.stringify(loggerWarnMock.mock.calls)
        expect(logged).not.toContain(HARDHAT_0_KEY_HEX)
    })
})
