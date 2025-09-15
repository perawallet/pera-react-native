import { describe, test, expect, vi } from 'vitest'
import type { WalletAccount } from '../types'

class MemoryKeyValueStorage {
	private store = new Map<string, string>()

	getItem(key: string): string | null {
		return this.store.get(key) ?? null
	}

	setItem(key: string, value: string): void {
		this.store.set(key, value)
	}

	removeItem(key: string): void {
		this.store.delete(key)
	}

	setJSON<T>(key: string, value: T): void {
		this.setItem(key, JSON.stringify(value))
	}

	getJSON<T>(key: string): T | null {
		const v = this.getItem(key)
		return v ? (JSON.parse(v) as T) : null
	}
}

const dummyRemote = {
	initializeRemoteConfig() {},
	getStringValue(_k: string, f?: string) {
		return f ?? ''
	},
	getBooleanValue(_k: string, f?: boolean) {
		return f ?? false
	},
	getNumberValue(_k: string, f?: number) {
		return f ?? 0
	},
}

const dummyNotif = {
	async initializeNotifications() {
		return { unsubscribe: () => {} }
	},
}

const dummyCrash = {
	initializeCrashReporting() {},
	recordNonFatalError(_e: unknown) {},
}

describe('services/accounts/hooks', () => {
	test('getAllAccounts, findAccountByAddress, and addAccount persist PK when provided', async () => {
		vi.resetModules()

		const { registerPlatformServices } = await import('../../../platform')
		const dummySecure = {
			setItem: vi.fn(async (_k: string, _v: string) => {}),
			getItem: vi.fn(async (_k: string) => null),
			removeItem: vi.fn(async (_k: string) => {}),
			authenticate: vi.fn(async () => true),
		}

		registerPlatformServices({
			keyValueStorage: new MemoryKeyValueStorage() as any,
			secureStorage: dummySecure as any,
			remoteConfig: dummyRemote as any,
			notification: dummyNotif as any,
			crashReporting: dummyCrash as any,
		})

		const { useAccounts } = await import('../hooks')
		const { useAppStore } = await import('../../../store')

		const api = useAccounts()

		// defaults
		expect(api.getAllAccounts()).toEqual([])

		const a1: WalletAccount = {
			id: '1',
			name: 'Alice',
			type: 'standard',
			address: 'ALICE',
		}

		// add with secret - should persist to secure storage
		api.addAccount(a1, 'secret')
		expect(useAppStore.getState().accounts).toEqual([a1])
		expect(dummySecure.setItem).toHaveBeenCalledWith('pk-ALICE', 'secret')

		// find present / absent
		expect(api.findAccountByAddress('ALICE')).toEqual(a1)
		expect(api.findAccountByAddress('MISSING')).toBeNull()
	})

	test('addAccount without secret does not persist PK', async () => {
		vi.resetModules()

		const { registerPlatformServices } = await import('../../../platform')
		const dummySecure = {
			setItem: vi.fn(async (_k: string, _v: string) => {}),
			getItem: vi.fn(async (_k: string) => null),
			removeItem: vi.fn(async (_k: string) => {}),
			authenticate: vi.fn(async () => true),
		}

		registerPlatformServices({
			keyValueStorage: new MemoryKeyValueStorage() as any,
			secureStorage: dummySecure as any,
			remoteConfig: dummyRemote as any,
			notification: dummyNotif as any,
			crashReporting: dummyCrash as any,
		})

		const { useAccounts } = await import('../hooks')
		const { useAppStore } = await import('../../../store')

		const api = useAccounts()

		const a: WalletAccount = {
			id: '2',
			name: 'Bob',
			type: 'standard',
			address: 'BOB',
		}

		api.addAccount(a)
		expect(useAppStore.getState().accounts).toEqual([a])
		expect(dummySecure.setItem).not.toHaveBeenCalled()
	})

	test('removeAccountById removes and clears persisted PK when privateKeyLocation is set', async () => {
		vi.resetModules()

		const { registerPlatformServices } = await import('../../../platform')
		const dummySecure = {
			setItem: vi.fn(async (_k: string, _v: string) => {}),
			getItem: vi.fn(async (_k: string) => null),
			removeItem: vi.fn(async (_k: string) => {}),
			authenticate: vi.fn(async () => true),
		}

		registerPlatformServices({
			keyValueStorage: new MemoryKeyValueStorage() as any,
			secureStorage: dummySecure as any,
			remoteConfig: dummyRemote as any,
			notification: dummyNotif as any,
			crashReporting: dummyCrash as any,
		})

		const { useAccounts } = await import('../hooks')
		const { useAppStore } = await import('../../../store')

		const api = useAccounts()

		const a: WalletAccount = {
			id: '3',
			name: 'Carol',
			type: 'standard',
			address: 'CAROL',
			privateKeyLocation: 'device',
		}

		api.addAccount(a)
		expect(useAppStore.getState().accounts).toEqual([a])

		api.removeAccountById('3')
		expect(useAppStore.getState().accounts).toEqual([])
		expect(dummySecure.removeItem).toHaveBeenCalledWith('pk-CAROL')
	})

	test('removeAccountByAddress removes and clears persisted PK when privateKeyLocation is set', async () => {
		vi.resetModules()

		const { registerPlatformServices } = await import('../../../platform')
		const dummySecure = {
			setItem: vi.fn(async (_k: string, _v: string) => {}),
			getItem: vi.fn(async (_k: string) => null),
			removeItem: vi.fn(async (_k: string) => {}),
			authenticate: vi.fn(async () => true),
		}

		registerPlatformServices({
			keyValueStorage: new MemoryKeyValueStorage() as any,
			secureStorage: dummySecure as any,
			remoteConfig: dummyRemote as any,
			notification: dummyNotif as any,
			crashReporting: dummyCrash as any,
		})

		const { useAccounts } = await import('../hooks')
		const { useAppStore } = await import('../../../store')

		const api = useAccounts()

		const a: WalletAccount = {
			id: '4',
			name: 'Dave',
			type: 'standard',
			address: 'DAVE',
			privateKeyLocation: 'device',
		}

		api.addAccount(a)
		expect(useAppStore.getState().accounts).toEqual([a])

		api.removeAccountByAddress('DAVE')
		expect(useAppStore.getState().accounts).toEqual([])
		expect(dummySecure.removeItem).toHaveBeenCalledWith('pk-DAVE')
	})
})
