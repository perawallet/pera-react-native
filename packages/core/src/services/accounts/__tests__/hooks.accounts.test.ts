import { describe, test, expect, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import type { WalletAccount } from '../types'
import { MemoryKeyValueStorage, registerTestPlatform } from '@test-utils'
// Hoisted mocks for createAccount path dependencies
const uuidSpies = vi.hoisted(() => ({ v7: vi.fn() }))
vi.mock('uuid', () => ({ v7: uuidSpies.v7 }))

const apiSpies = vi.hoisted(() => ({
  deriveSpy: vi.fn(),
  keyGenSpy: vi.fn(),
}))
const xhdSpies = vi.hoisted(() => ({
  fromSeed: vi.fn(() => 'ROOT_KEY'),
}))
const bip39Spies = vi.hoisted(() => ({
  generateMnemonic: vi.fn(() => 'GENERATED_MNEMO'),
  mnemonicToSeedSync: vi.fn(() => Buffer.from('seed_sync')),
  mnemonicToSeed: vi.fn(async () => Buffer.from('seed_async')),
}))

vi.mock('@algorandfoundation/xhd-wallet-api', () => {
  return {
    BIP32DerivationType: { Peikert: 'PEIKERT' },
    fromSeed: xhdSpies.fromSeed,
    KeyContext: { Address: 'Address' },
    XHDWalletAPI: vi.fn().mockImplementation(() => ({
      deriveKey: apiSpies.deriveSpy,
      keyGen: apiSpies.keyGenSpy,
    })),
  }
})
vi.mock('bip39', () => bip39Spies)

describe('services/accounts/hooks', () => {
	test('getDisplayAddress permutations', async () => {
		vi.resetModules()

		const { useDisplayAddress } = await import('../hooks.accounts')

		const a1: WalletAccount = {
			id: '1',
			type: 'standard',
			address: 'SHORT',
		}
		const { result } = renderHook(() => useDisplayAddress(a1))
		expect(result.current).toEqual('SHORT')

		const a2: WalletAccount = {
			id: '1',
			type: 'standard',
			address: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
		}
		const { result: result2 } = renderHook(() => useDisplayAddress(a2))
		expect(result2.current).toEqual('ABCDE...VWXYZ')

		const a3: WalletAccount = {
			id: '1',
			type: 'standard',
			address: 'ABCDEFGHIJKL',
		}
		const { result: result3 } = renderHook(() => useDisplayAddress(a3))
		expect(result3.current).toEqual('ABCDE...HIJKL')

		const a4: WalletAccount = {
			id: '1',
			name: 'Named',
			type: 'standard',
			address: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
		}
		const { result: result4 } = renderHook(() => useDisplayAddress(a4))
		expect(result4.current).toEqual('Named')
	})

	test('getAllAccounts, findAccountByAddress, and addAccount persist PK when provided', async () => {
		vi.resetModules()

		const dummySecure = {
			setItem: vi.fn(async (_k: string, _v: string) => {}),
			getItem: vi.fn(async (_k: string) => null),
			removeItem: vi.fn(async (_k: string) => {}),
			authenticate: vi.fn(async () => true),
		}

		registerTestPlatform({
			keyValueStorage: new MemoryKeyValueStorage() as any,
			secureStorage: dummySecure as any,
		})

		const { useAppStore } = await import('../../../store')
		const { useAccounts } = await import('../hooks.accounts')

		const { result } = renderHook(() => useAccounts())

		// defaults
		expect(result.current.getAllAccounts()).toEqual([])

		const a1: WalletAccount = {
			id: '1',
			name: 'Alice',
			type: 'standard',
			address: 'ALICE',
		}

		// add with secret - should persist to secure storage
		act(() => {
			result.current.addAccount(a1, 'secret')
		})
		expect(useAppStore.getState().accounts).toEqual([a1])
		expect(dummySecure.setItem).toHaveBeenCalledWith('pk-ALICE', 'secret')

		// find present / absent
		expect(result.current.findAccountByAddress('ALICE')).toEqual(a1)
		expect(result.current.findAccountByAddress('MISSING')).toBeNull()
	})

	test('addAccount without secret does not persist PK', async () => {
		vi.resetModules()

		const dummySecure = {
			setItem: vi.fn(async (_k: string, _v: string) => {}),
			getItem: vi.fn(async (_k: string) => null),
			removeItem: vi.fn(async (_k: string) => {}),
			authenticate: vi.fn(async () => true),
		}

		registerTestPlatform({
			keyValueStorage: new MemoryKeyValueStorage() as any,
			secureStorage: dummySecure as any,
		})

		const { useAppStore } = await import('../../../store')
		const { useAccounts } = await import('../hooks.accounts')

		const { result } = renderHook(() => useAccounts())

		const a: WalletAccount = {
			id: '2',
			name: 'Bob',
			type: 'standard',
			address: 'BOB',
		}

		act(() => {
			result.current.addAccount(a)
		})
		expect(useAppStore.getState().accounts).toEqual([a])
		expect(dummySecure.setItem).not.toHaveBeenCalled()
	})

	test('removeAccountById removes and clears persisted PK when privateKeyLocation is set', async () => {
		vi.resetModules()

		const dummySecure = {
			setItem: vi.fn(async (_k: string, _v: string) => {}),
			getItem: vi.fn(async (_k: string) => null),
			removeItem: vi.fn(async (_k: string) => {}),
			authenticate: vi.fn(async () => true),
		}

		registerTestPlatform({
			keyValueStorage: new MemoryKeyValueStorage() as any,
			secureStorage: dummySecure as any,
		})

		const { useAppStore } = await import('../../../store')
		const { useAccounts } = await import('../hooks.accounts')

		const { result } = renderHook(() => useAccounts())

		const a: WalletAccount = {
			id: '3',
			name: 'Carol',
			type: 'standard',
			address: 'CAROL',
			privateKeyLocation: 'device',
		}

		act(() => {
			result.current.addAccount(a)
		})
		expect(useAppStore.getState().accounts).toEqual([a])

		act(() => {
			result.current.removeAccountById('3')
		})
		expect(useAppStore.getState().accounts).toEqual([])
		expect(dummySecure.removeItem).toHaveBeenCalledWith('pk-CAROL')
	})

	test('removeAccountByAddress removes and clears persisted PK when privateKeyLocation is set', async () => {
		vi.resetModules()

		const dummySecure = {
			setItem: vi.fn(async (_k: string, _v: string) => {}),
			getItem: vi.fn(async (_k: string) => null),
			removeItem: vi.fn(async (_k: string) => {}),
			authenticate: vi.fn(async () => true),
		}

		registerTestPlatform({
			keyValueStorage: new MemoryKeyValueStorage() as any,
			secureStorage: dummySecure as any,
		})

		const { useAppStore } = await import('../../../store')
		const { useAccounts } = await import('../hooks.accounts')

		const { result } = renderHook(() => useAccounts())

		const a: WalletAccount = {
			id: '4',
			name: 'Dave',
			type: 'standard',
			address: 'DAVE',
			privateKeyLocation: 'device',
		}

		act(() => {
			result.current.addAccount(a)
		})
		expect(useAppStore.getState().accounts).toEqual([a])

		act(() => {
			result.current.removeAccountByAddress('DAVE')
		})
		expect(useAppStore.getState().accounts).toEqual([])
		expect(dummySecure.removeItem).toHaveBeenCalledWith('pk-DAVE')
	})
})

describe('services/accounts/hooks - createAccount', () => {
	test('createAccount generates mnemonic when none exists, persists root key and PK, and returns account', async () => {
		vi.resetModules()
		vi.clearAllMocks()
		uuidSpies.v7.mockReset()
		apiSpies.deriveSpy.mockReset()
		apiSpies.keyGenSpy.mockReset()

		const dummySecure = {
			setItem: vi.fn(async (_k: string, _v: string) => {}),
			getItem: vi.fn(async (_k: string) => null),
			removeItem: vi.fn(async (_k: string) => {}),
			authenticate: vi.fn(async () => true),
		}

		registerTestPlatform({
			keyValueStorage: new MemoryKeyValueStorage() as any,
			secureStorage: dummySecure as any,
		})

		// XHD-API responses (ArrayBuffers) => base64('PRIVKEY'), base64('ADDRESS')
		const priv = new Uint8Array([80, 82, 73, 86, 75, 69, 89]).buffer // 'PRIVKEY'
		const addr = new Uint8Array([65, 68, 68, 82, 69, 83, 83]).buffer // 'ADDRESS'
		apiSpies.deriveSpy.mockResolvedValueOnce(priv)
		apiSpies.keyGenSpy.mockResolvedValueOnce(addr)

		// uuid: walletId, pk id, account id
		uuidSpies.v7
			.mockImplementationOnce(() => 'WALLET1')
			.mockImplementationOnce(() => 'KEY1')
			.mockImplementationOnce(() => 'ACC1')

		const { useAppStore } = await import('../../../store')
		const { useAccounts } = await import('../hooks.accounts')

		const { result } = renderHook(() => useAccounts())
		let created: any
		await act(async () => {
			created = await result.current.createAccount({ account: 2, keyIndex: 5 })
		})

		const expectedPk = Buffer.from('PRIVKEY').toString('base64')
		const expectedAddr = Buffer.from('ADDRESS').toString('base64')

		expect(dummySecure.getItem).toHaveBeenCalledWith('rootkey-WALLET1')
		expect(bip39Spies.generateMnemonic).toHaveBeenCalledTimes(1)
		expect(dummySecure.setItem).toHaveBeenCalledWith('rootkey-WALLET1', Buffer.from('GENERATED_MNEMO').toString('base64'))
		expect(dummySecure.setItem).toHaveBeenCalledWith('pk-KEY1', expectedPk)

		expect(created).toMatchObject({
			id: 'ACC1',
			address: expectedAddr,
			type: 'standard',
			privateKeyLocation: 'pk-KEY1',
			hdWalletDetails: {
				walletId: 'WALLET1',
				account: 2,
				change: 0,
				keyIndex: 5,
				derivationType: 'PEIKERT',
			},
		})

		expect(useAppStore.getState().accounts).toHaveLength(1)
		expect(useAppStore.getState().accounts[0]).toMatchObject({
			address: expectedAddr,
			privateKeyLocation: 'pk-KEY1',
		})
	})

	test('createAccount reuses existing mnemonic with provided walletId and only persists PK', async () => {
		vi.resetModules()
		vi.clearAllMocks()
		uuidSpies.v7.mockReset()
		apiSpies.deriveSpy.mockReset()
		apiSpies.keyGenSpy.mockReset()

		const dummySecure = {
			setItem: vi.fn(async (_k: string, _v: string) => {}),
			getItem: vi.fn(async (_k: string) => 'SAVED_MNEMO'),
			removeItem: vi.fn(async (_k: string) => {}),
			authenticate: vi.fn(async () => true),
		}

		registerTestPlatform({
			keyValueStorage: new MemoryKeyValueStorage() as any,
			secureStorage: dummySecure as any,
		})

		// XHD-API responses
		const priv = new Uint8Array([80, 82, 73, 86, 75, 69, 89]).buffer // 'PRIVKEY'
		const addr = new Uint8Array([65, 68, 68, 82, 69, 83, 83]).buffer // 'ADDRESS'
		apiSpies.deriveSpy.mockResolvedValueOnce(priv)
		apiSpies.keyGenSpy.mockResolvedValueOnce(addr)

		// uuid: pk id, account id (walletId is provided)
		uuidSpies.v7.mockImplementationOnce(() => 'KEY2').mockImplementationOnce(() => 'ACC2')

		const { useAppStore } = await import('../../../store')
		const { useAccounts } = await import('../hooks.accounts')

		const { result } = renderHook(() => useAccounts())
		let created: any
		await act(async () => {
			created = await result.current.createAccount({
				walletId: 'EXIST',
				account: 1,
				keyIndex: 3,
			})
		})

		const expectedPk = Buffer.from('PRIVKEY').toString('base64')
		const expectedAddr = Buffer.from('ADDRESS').toString('base64')

		expect(dummySecure.getItem).toHaveBeenCalledWith('rootkey-EXIST')
		expect(bip39Spies.generateMnemonic).not.toHaveBeenCalled()

		const setCalls = (dummySecure.setItem as any).mock.calls as any[]
		expect(setCalls.some(c => String(c[0]).startsWith('rootkey-'))).toBe(false)
		expect(dummySecure.setItem).toHaveBeenCalledWith('pk-KEY2', expectedPk)

		expect(created).toMatchObject({
			id: 'ACC2',
			address: expectedAddr,
			type: 'standard',
			privateKeyLocation: 'pk-KEY2',
			hdWalletDetails: {
				walletId: 'EXIST',
				account: 1,
				change: 0,
				keyIndex: 3,
				derivationType: 'PEIKERT',
			},
		})

		expect(useAppStore.getState().accounts.find((a: any) => a.id === 'ACC2')).toBeTruthy()
	})
})

describe('services/accounts/hooks - updateAccount', () => {
	test('updateAccount replaces account and persists PK when provided', async () => {
		vi.resetModules()

		const dummySecure = {
			setItem: vi.fn(async (_k: string, _v: string) => {}),
			getItem: vi.fn(async (_k: string) => null),
			removeItem: vi.fn(async (_k: string) => {}),
			authenticate: vi.fn(async () => true),
		}

		registerTestPlatform({
			keyValueStorage: new MemoryKeyValueStorage() as any,
			secureStorage: dummySecure as any,
		})

		const { useAppStore } = await import('../../../store')
		const { useAccounts } = await import('../hooks.accounts')

		const { result } = renderHook(() => useAccounts())

		const initial: WalletAccount = {
			id: 'ID1',
			type: 'standard',
			address: 'ADDR1',
			name: 'Old Name',
		}

		// seed store
		act(() => {
			result.current.addAccount(initial)
		})
		expect(useAppStore.getState().accounts).toEqual([initial])

		// update same address with new fields
		const updated: WalletAccount = {
			...initial,
			name: 'New Name',
		}

		act(() => {
			result.current.updateAccount(updated, 'new-secret')
		})

		// state replaced with updated object
		expect(useAppStore.getState().accounts).toEqual([updated])
		// PK persisted when provided
		expect(dummySecure.setItem).toHaveBeenCalledWith('pk-ADDR1', 'new-secret')
	})

	test('updateAccount replaces account without persisting PK when not provided', async () => {
		vi.resetModules()

		const dummySecure = {
			setItem: vi.fn(async (_k: string, _v: string) => {}),
			getItem: vi.fn(async (_k: string) => null),
			removeItem: vi.fn(async (_k: string) => {}),
			authenticate: vi.fn(async () => true),
		}

		registerTestPlatform({
			keyValueStorage: new MemoryKeyValueStorage() as any,
			secureStorage: dummySecure as any,
		})

		const { useAppStore } = await import('../../../store')
		const { useAccounts } = await import('../hooks.accounts')

		const { result } = renderHook(() => useAccounts())

		const initial: WalletAccount = {
			id: 'ID2',
			type: 'standard',
			address: 'ADDR2',
			name: 'Before',
		}

		act(() => {
			result.current.addAccount(initial)
		})
		expect(useAppStore.getState().accounts).toEqual([initial])

		const updated: WalletAccount = {
			...initial,
			name: 'After',
		}

		act(() => {
			result.current.updateAccount(updated)
		})

		expect(useAppStore.getState().accounts).toEqual([updated])
		expect(dummySecure.setItem).not.toHaveBeenCalled()
	})
})
