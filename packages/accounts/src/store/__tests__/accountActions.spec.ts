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

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest'
import {
    addHardwareChainAccount,
    getAllAccounts,
    getSelectedAccount,
    getSelectedAccountId,
    importAccountFromPrivateKey,
    updateHardwareDetails,
    upgradeWatchAccountToHardware,
} from '../accountActions'
import { useAccountsStore } from '../store'
import { testAccount } from '../../__tests__/accountFactory'

vi.mock('@perawallet/wallet-core-shared', async importOriginal => {
    const original =
        await importOriginal<typeof import('@perawallet/wallet-core-shared')>()
    const { createMockPersistStorage } = await vi.importActual<
        typeof import('@perawallet/wallet-core-shared/test-utils')
    >('@perawallet/wallet-core-shared/test-utils')
    return {
        ...original,
        registerStore: vi.fn(),
        createPersistStorage: createMockPersistStorage,
    }
})

describe('account readers', () => {
    beforeEach(() => {
        useAccountsStore.setState({ accounts: [], selectedAccountId: null })
    })

    test('getAllAccounts follows the store, including a write after an earlier read', () => {
        expect(getAllAccounts()).toEqual([])

        const added = testAccount('watch', 'A', { id: 'a' })
        useAccountsStore.getState().setAccounts([added])

        expect(getAllAccounts()).toEqual([added])
    })

    test('getSelectedAccountId and getSelectedAccount follow the selection', () => {
        const first = testAccount('watch', 'A', { id: 'a' })
        const second = testAccount('watch', 'B', { id: 'b' })
        useAccountsStore.setState({
            accounts: [first, second],
            selectedAccountId: 'a',
        })
        expect(getSelectedAccountId()).toBe('a')
        expect(getSelectedAccount()).toEqual(first)

        useAccountsStore.getState().setSelectedAccountId('b')

        expect(getSelectedAccountId()).toBe('b')
        expect(getSelectedAccount()).toEqual(second)
    })

    test('getSelectedAccount is null once the selected account is gone', () => {
        useAccountsStore.setState({ accounts: [], selectedAccountId: 'gone' })

        expect(getSelectedAccount()).toBeNull()
    })
})

describe('account actions', () => {
    const actions = {
        importAccountFromPrivateKey,
        addHardwareChainAccount,
        upgradeWatchAccountToHardware,
        updateHardwareDetails,
    }
    const names = Object.keys(actions) as (keyof typeof actions)[]
    const original = Object.fromEntries(
        names.map(name => [name, useAccountsStore.getState()[name]]),
    )

    afterEach(() => {
        useAccountsStore.setState(original)
    })

    test.each(names)(
        '%s passes its arguments to the store action and returns its result',
        name => {
            const stub = vi.fn().mockReturnValue('result')
            useAccountsStore.setState({ [name]: stub })

            const forward = actions[name] as (...args: unknown[]) => unknown
            const result = forward('one', 'two', 'three')

            expect(stub).toHaveBeenCalledWith('one', 'two', 'three')
            expect(result).toBe('result')
        },
    )
})
