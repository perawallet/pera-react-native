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
			setAccounts: accounts => {
				captured = accounts
			},
		}

		const partial = partializeAccountsSlice(state)
		expect(partial).toEqual({ accounts: state.accounts })

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
