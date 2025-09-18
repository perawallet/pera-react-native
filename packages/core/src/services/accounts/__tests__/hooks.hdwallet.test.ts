import { describe, test, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'

// Hoisted spies and mocks for wallet API and bip39
const apiSpies = vi.hoisted(() => {
	return {
		deriveSpy: vi.fn(),
		keyGenSpy: vi.fn(),
		signTxnSpy: vi.fn(),
		signDataSpy: vi.fn(),
	}
})

const xhdSpies = vi.hoisted(() => {
	return {
		fromSeed: vi.fn(() => 'ROOT_KEY'),
	}
})

const bip39Spies = vi.hoisted(() => {
	return {
		generateMnemonic: vi.fn(() => 'test mnemonic'),
		mnemonicToSeedSync: vi.fn(() => Buffer.from('seed_sync')),
		mnemonicToSeed: vi.fn(async () => Buffer.from('seed_async')),
	}
})

vi.mock('@perawallet/xhdwallet', () => {
	return {
		BIP32DerivationType: { Peikert: 'PEIKERT', Other: 'OTHER' },
		Encoding: { BASE64: 'BASE64' },
		fromSeed: xhdSpies.fromSeed,
		KeyContext: { Address: 'Address' },
		XHDWalletAPI: vi.fn().mockImplementation(() => ({
			deriveKey: apiSpies.deriveSpy,
			keyGen: apiSpies.keyGenSpy,
			signAlgoTransaction: apiSpies.signTxnSpy,
			signData: apiSpies.signDataSpy,
		})),
	}
})

vi.mock('bip39', () => bip39Spies)

describe('services/accounts/useHDWallet', () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	test('createMnemonic delegates to bip39.generateMnemonic', async () => {
		vi.resetModules()
		const { useHDWallet } = await import('../hooks.hdwallet')
		const { result } = renderHook(() => useHDWallet())
		const phrase = result.current.createMnemonic()
		expect(bip39Spies.generateMnemonic).toHaveBeenCalledTimes(1)
		expect(phrase).toBe('test mnemonic')
	})

	test('mnemonicToRootKey derives root key via bip39.mnemonicToSeed + fromSeed', async () => {
		vi.resetModules()
		const seedBuf = Buffer.from('async_seed')
		;(bip39Spies.mnemonicToSeed as any).mockResolvedValueOnce(seedBuf)
		const { useHDWallet } = await import('../hooks.hdwallet')
		const { result } = renderHook(() => useHDWallet())
		const root = await result.current.mnemonicToRootKey('words')
		expect(bip39Spies.mnemonicToSeed).toHaveBeenCalledWith('words')
		expect(xhdSpies.fromSeed).toHaveBeenCalledWith(seedBuf)
		expect(root).toBe('ROOT_KEY')
	})

	test('deriveKey uses defaults and returns base64-encoded key material', async () => {
		vi.resetModules()
		const syncSeed = Buffer.from('sync_seed')
		;(bip39Spies.mnemonicToSeedSync as any).mockReturnValueOnce(syncSeed)

		// Prepare API responses: "PRIVKEY" and "ADDRESS"
		const priv = new Uint8Array([80, 82, 73, 86, 75, 69, 89])
		const addr = new Uint8Array([65, 68, 68, 82, 69, 83, 83])
		apiSpies.deriveSpy.mockResolvedValueOnce(priv)
		apiSpies.keyGenSpy.mockResolvedValueOnce(addr)

		const { useHDWallet } = await import('../hooks.hdwallet')
		const { result } = renderHook(() => useHDWallet())
		const out = await result.current.deriveKey({ mnemonic: 'm n e m o n i c' })

		// Assert calls
		expect(xhdSpies.fromSeed).toHaveBeenCalledWith(syncSeed)
		expect(apiSpies.deriveSpy).toHaveBeenCalledWith(
			'ROOT_KEY',
			[44, 283, 0, 0, 0],
			true,
			'PEIKERT',
		)
		expect(apiSpies.keyGenSpy).toHaveBeenCalledWith(
			'ROOT_KEY',
			'Address',
			0,
			0,
			'PEIKERT',
		)

		// Assert base64
		expect(out.privateKey).toBe(Buffer.from('PRIVKEY').toString('base64'))
		expect(out.address).toBe(Buffer.from('ADDRESS').toString('base64'))
	})

	test('deriveKey allows overriding account, keyIndex and derivationType', async () => {
		vi.resetModules()
		;(bip39Spies.mnemonicToSeedSync as any).mockReturnValueOnce(
			Buffer.from('sync_seed'),
		)

		// Mock API responses (values not important)
		apiSpies.deriveSpy.mockResolvedValueOnce(new Uint8Array([49]).buffer)
		apiSpies.keyGenSpy.mockResolvedValueOnce(new Uint8Array([50]).buffer)

		const { useHDWallet } = await import('../hooks.hdwallet')
		const xhd = await import('@perawallet/xhdwallet')
		const { result } = renderHook(() => useHDWallet())
		await result.current.deriveKey({
			mnemonic: 'x',
			account: 7,
			keyIndex: 9,
			derivationType: (xhd as any).BIP32DerivationType.Other,
		})

		expect(apiSpies.deriveSpy).toHaveBeenCalledWith(
			'ROOT_KEY',
			[44, 283, 7, 0, 9],
			true,
			'OTHER',
		)
		expect(apiSpies.keyGenSpy).toHaveBeenCalledWith(
			'ROOT_KEY',
			'Address',
			7,
			9,
			'OTHER',
		)
	})

	test('signTransaction derives root and signs with correct params', async () => {
		vi.resetModules()
		;(bip39Spies.mnemonicToSeedSync as any).mockReturnValueOnce(
			Buffer.from('sync_seed'),
		)
		apiSpies.signTxnSpy.mockResolvedValueOnce('SIGNED_TX')

		const { useHDWallet } = await import('../hooks.hdwallet')
		const { result } = renderHook(() => useHDWallet())
		const hd: any = {
			walletId: 'w',
			account: 4,
			change: 0,
			keyIndex: 6,
			derivationType: 'PEIKERT',
		}
		const txn = Buffer.from('txn')
		const signed = await result.current.signTransaction('mnemo', hd, txn)

		expect(xhdSpies.fromSeed).toHaveBeenCalled()
		expect(apiSpies.signTxnSpy).toHaveBeenCalledWith(
			'ROOT_KEY',
			'Address',
			4,
			6,
			txn,
			'PEIKERT',
		)
		expect(signed).toBe('SIGNED_TX')
	})

	test('signData derives root and signs with BASE64 metadata schema', async () => {
		vi.resetModules()
		;(bip39Spies.mnemonicToSeedSync as any).mockReturnValueOnce(
			Buffer.from('sync_seed'),
		)
		apiSpies.signDataSpy.mockResolvedValueOnce('SIGNED_DATA')

		const { useHDWallet } = await import('../hooks.hdwallet')
		const { result } = renderHook(() => useHDWallet())
		const hd: any = {
			walletId: 'w',
			account: 1,
			change: 0,
			keyIndex: 2,
			derivationType: 'PEIKERT',
		}
		const payload = Buffer.from('data')
		const signed = await result.current.signData('mnemo', hd, payload)

		expect(apiSpies.signDataSpy).toHaveBeenCalled()
		const call = (apiSpies.signDataSpy as any).mock.calls[0]
		expect(call[0]).toBe('ROOT_KEY')
		expect(call[1]).toBe('Address')
		expect(call[2]).toBe(1)
		expect(call[3]).toBe(2)
		expect(call[4]).toBe(payload)
		expect(call[5]).toEqual(
			expect.objectContaining({ encoding: 'BASE64', schema: expect.anything() }),
		)
		expect(call[6]).toBe('PEIKERT')
		expect(signed).toBe('SIGNED_DATA')
	})
})
