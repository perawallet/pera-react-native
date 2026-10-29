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

import { renderHook, act } from '@test-utils/render'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { logger } from '@perawallet/wallet-core-shared'
import { capabilityState } from '@test-utils/capability-mock'
import { useImportPrivateKeyScreen } from '../useImportPrivateKeyScreen'

const CHAIN_ID = 'algorand'
const VALID_KEY = 'valid-key'

const mocks = vi.hoisted(() => ({
    push: vi.fn(),
    showError: vi.fn(),
    importAccountFromPrivateKey: vi.fn(),
    parsed: [] as Uint8Array[],
    isCloudBackupEnabled: true,
    isConfigured: true,
}))

vi.mock('@react-navigation/native', async () => ({
    ...(await vi.importActual<object>('@react-navigation/native')),
    useRoute: () => ({ params: { chainId: 'algorand' } }),
}))

vi.mock('@hooks/useAppNavigation', () => ({
    useAppNavigation: () => ({ push: mocks.push }),
}))

vi.mock('@hooks/useErrorToast', () => ({
    useErrorToast: () => ({ showError: mocks.showError }),
}))

vi.mock('@hooks/useIsCloudBackupEnabled', () => ({
    useIsCloudBackupEnabled: () => mocks.isCloudBackupEnabled,
}))

vi.mock('@hooks/useCapability', async () =>
    (await import('@test-utils/capability-mock')).capabilityHookMock(),
)

vi.mock('@perawallet/wallet-core-backup', () => ({
    useCloudBackupStore: (
        selector: (state: { isConfigured: () => boolean }) => unknown,
    ) => selector({ isConfigured: () => mocks.isConfigured }),
}))

vi.mock('@perawallet/wallet-core-accounts', async () => {
    const parse = (_chainId: string, input: string): Uint8Array => {
        if (input !== 'valid-key') throw new Error('invalid')
        const bytes = Uint8Array.of(7, 7, 7)
        mocks.parsed.push(bytes)
        return bytes
    }
    return {
        ...(await vi.importActual<object>('@perawallet/wallet-core-accounts')),
        parsePrivateKey: parse,
        isValidPrivateKeyInput: (chainId: string, input: string) => {
            try {
                parse(chainId, input).fill(0)
                return true
            } catch {
                return false
            }
        },
        importAccountFromPrivateKey: mocks.importAccountFromPrivateKey,
    }
})

const IMPORTED = {
    id: 'imported',
    custody: { kind: 'local', seed: null },
    chains: { algorand: { address: 'ADDR', keyPairId: 'k' } },
}

const render = () => renderHook(() => useImportPrivateKeyScreen())

const enter = (
    result: ReturnType<typeof render>['result'],
    text: string,
): void =>
    act(() => {
        result.current.handleChangeText(text)
    })

describe('useImportPrivateKeyScreen', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        capabilityState.reset()
        mocks.parsed = []
        mocks.isCloudBackupEnabled = true
        mocks.isConfigured = true
        mocks.importAccountFromPrivateKey.mockResolvedValue(IMPORTED)
    })

    it('starts empty and invalid, naming the chain', () => {
        const { result } = render()

        expect(result.current.hasInput).toBe(false)
        expect(result.current.isValidInput).toBe(false)
        expect(result.current.chainName).toBe('Algorand')
    })

    it('tracks whether the entered text is a valid key, zeroing the bytes it parsed', () => {
        const { result } = render()

        enter(result, 'nope')
        expect(result.current.hasInput).toBe(true)
        expect(result.current.isValidInput).toBe(false)

        enter(result, VALID_KEY)
        expect(result.current.isValidInput).toBe(true)
        expect(mocks.parsed.every(b => b.every(byte => byte === 0))).toBe(true)
    })

    it('imports the key on the chain and names the new account there', async () => {
        const { result } = render()
        enter(result, VALID_KEY)

        await act(async () => {
            result.current.handleImport()
        })

        const handedOff = mocks.importAccountFromPrivateKey.mock.calls[0]?.[1]
        expect(mocks.importAccountFromPrivateKey).toHaveBeenCalledWith(
            CHAIN_ID,
            expect.any(Uint8Array),
        )
        expect(Array.from(handedOff as Uint8Array)).toEqual([0, 0, 0])
        expect(mocks.push).toHaveBeenCalledWith('NameAccount', {
            account: IMPORTED,
            chainId: CHAIN_ID,
        })
        expect(result.current.isImporting).toBe(false)
    })

    it('imports once when Import is tapped twice before a re-render', async () => {
        const { result } = render()
        enter(result, VALID_KEY)

        await act(async () => {
            result.current.handleImport()
            result.current.handleImport()
        })

        expect(mocks.importAccountFromPrivateKey).toHaveBeenCalledTimes(1)
        expect(mocks.showError).not.toHaveBeenCalled()
        expect(mocks.push).toHaveBeenCalledTimes(1)
    })

    it('does nothing while the input is invalid', async () => {
        const { result } = render()
        enter(result, 'nope')

        await act(async () => {
            result.current.handleImport()
        })

        expect(mocks.importAccountFromPrivateKey).not.toHaveBeenCalled()
    })

    it('shows the error toast for a key already held, and needs the key entered again', async () => {
        const error = new Error('duplicate')
        mocks.importAccountFromPrivateKey.mockRejectedValue(error)
        const { result } = render()
        enter(result, VALID_KEY)

        await act(async () => {
            result.current.handleImport()
        })

        expect(mocks.showError).toHaveBeenCalledWith(
            error,
            'onboarding.import_private_key.error_title',
        )
        expect(mocks.push).not.toHaveBeenCalled()
        expect(result.current.isImporting).toBe(false)
        expect(result.current.isValidInput).toBe(false)
        expect(mocks.parsed.at(-1)?.every(byte => byte === 0)).toBe(true)

        await act(async () => {
            result.current.handleImport()
        })
        expect(mocks.importAccountFromPrivateKey).toHaveBeenCalledTimes(1)
    })

    it('never logs the entered key', async () => {
        const spies = (['debug', 'info', 'warn', 'error'] as const).map(level =>
            vi.spyOn(logger, level),
        )
        mocks.importAccountFromPrivateKey.mockRejectedValue(new Error('x'))
        const { result } = render()
        enter(result, VALID_KEY)

        await act(async () => {
            result.current.handleImport()
        })

        for (const spy of spies) {
            expect(JSON.stringify(spy.mock.calls)).not.toContain(VALID_KEY)
        }
    })

    it.each([
        ['cloud backup is off', () => (mocks.isCloudBackupEnabled = false)],
        [
            "the chain isn't backed up",
            () => capabilityState.turnOff('cloudBackup'),
        ],
        ['no backup is set up', () => (mocks.isConfigured = false)],
    ])('says the account is not in a backup when %s', (_label, arrange) => {
        arrange()

        const { result } = render()

        expect(result.current.isIncludedInCloudBackup).toBe(false)
    })

    it('says the account is in the backup when all three hold', () => {
        const { result } = render()

        expect(result.current.isIncludedInCloudBackup).toBe(true)
    })
})
