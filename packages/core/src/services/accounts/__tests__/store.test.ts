import {
    createAccountsSlice,
    partializeAccountsSlice,
    type AccountsSlice,
} from '../store'
import type { WalletAccount } from '../types'

describe('services/accounts/store', () => {
    test('defaults to empty list and setAccounts updates state', () => {
        let state: AccountsSlice

        const set = (partial: Partial<AccountsSlice>) => {
            state = {
                ...(state as AccountsSlice),
                ...(partial as AccountsSlice),
            }
        }
        const get = () => state

        // initialize slice
        state = createAccountsSlice(set as any, get as any, {} as any)

        // defaults
        expect(state.accounts).toEqual([])

        // update
        const a1: WalletAccount = {
            id: '1',
            name: 'Alice',
            type: 'standard',
            address: 'ALICE-ADDR',
        }
        const a2: WalletAccount = {
            id: '2',
            name: 'Bob',
            type: 'standard',
            address: 'BOB-ADDR',
        }

        state.setAccounts([a1, a2])
        expect(state.accounts).toEqual([a1, a2])

        // further update
        const a3: WalletAccount = {
            id: '3',
            name: 'Carol',
            type: 'standard',
            address: 'CAROL-ADDR',
        }
        state.setAccounts([a1, a3])
        expect(state.accounts).toEqual([a1, a3])
    })

    test('getSelectedAccount returns the selected account', () => {
        let state: AccountsSlice

        const set = (partial: Partial<AccountsSlice>) => {
            state = {
                ...(state as AccountsSlice),
                ...(partial as AccountsSlice),
            }
        }
        const get = () => state

        state = createAccountsSlice(set as any, get as any, {} as any)

        const a1: WalletAccount = {
            id: '1',
            name: 'Alice',
            type: 'standard',
            address: 'ALICE-ADDR',
        }
        const a2: WalletAccount = {
            id: '2',
            name: 'Bob',
            type: 'standard',
            address: 'BOB-ADDR',
        }

        state.setAccounts([a1, a2])

        // Test default selection (index 0)
        expect(state.getSelectedAccount()).toBeNull()

        // Test selecting index 1
        state.setSelectedAccountAddress(a2.address)
        expect(state.getSelectedAccount()).toEqual(a2)

        // Test null address
        state.setSelectedAccountAddress(null)
        expect(state.getSelectedAccount()).toBeNull()

        // Test invalid index (out of bounds)
        state.setSelectedAccountAddress("someotheraddressthatdoesn'texist")
        expect(state.getSelectedAccount()).toBeNull()
    })

    test('setAccounts resets selectedAccountIndex to 0', () => {
        let state: AccountsSlice

        const set = (partial: Partial<AccountsSlice>) => {
            state = {
                ...(state as AccountsSlice),
                ...(partial as AccountsSlice),
            }
        }
        const get = () => state

        state = createAccountsSlice(set as any, get as any, {} as any)

        const a1: WalletAccount = {
            id: '1',
            name: 'Alice',
            type: 'standard',
            address: 'ALICE-ADDR',
        }
        const a2: WalletAccount = {
            id: '2',
            name: 'Bob',
            type: 'standard',
            address: 'BOB-ADDR',
        }

        state.setAccounts([a1, a2])
        state.setSelectedAccountAddress(a1.address)
        expect(state.selectedAccountAddress).toBe(a1.address)

        // Setting new accounts should reset index to 0
        state.setAccounts([a2])
        expect(state.selectedAccountAddress).toBeNull()
    })

    test('partializeAccountsSlice returns only the persisted subset', () => {
        let captured: WalletAccount[] = []
        const state: AccountsSlice = {
            accounts: [
                {
                    id: '10',
                    name: 'Zed',
                    type: 'standard',
                    address: 'ZED-ADDR',
                },
            ],
            selectedAccountAddress: 'ZED-ADDR',
            getSelectedAccount: () => null,
            setAccounts: accounts => {
                captured = accounts
            },
            setSelectedAccountAddress: () => {},
        }

        const partial = partializeAccountsSlice(state)
        expect(partial).toEqual({
            accounts: state.accounts,
            selectedAccountAddress: state.selectedAccountAddress,
        })

        // ensure we didn't accidentally include functions
        expect((partial as any).setAccounts).toBeUndefined()

        // validate that updater still behaves as expected
        const updated: WalletAccount[] = [
            {
                id: '11',
                name: 'Yen',
                type: 'standard',
                address: 'YEN-ADDR',
            },
        ]
        state.setAccounts(updated)
        expect(captured).toEqual(updated)
    })
})
