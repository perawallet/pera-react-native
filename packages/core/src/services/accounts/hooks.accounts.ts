import { useAppStore } from '../../store'
import { useSecureStorageService } from '../storage'
import type { WalletAccount } from './types'
import {
	BIP32DerivationType,
} from '@algorandfoundation/xhd-wallet-api'
import { v7 as uuidv7 } from 'uuid'
import { useHDWallet } from './hooks.hdwallet'

const MAX_ADDRESS_DISPLAY = 11
const ADDRESS_DISPLAY_PREFIX_LENGTH = 5

export const useDisplayAddress = (account: WalletAccount) => {
	if (account.name) return account.name
	if (account.address.length <= MAX_ADDRESS_DISPLAY) return account.address
	return `${account.address.substring(0, ADDRESS_DISPLAY_PREFIX_LENGTH)}...${account.address.substring(account.address.length - ADDRESS_DISPLAY_PREFIX_LENGTH)}`
}

// Services relating to locally stored accounts
export const useAccounts = () => {
	const accounts = useAppStore(state => state.accounts)
	const setAccounts = useAppStore(state => state.setAccounts)
	const { createMnemonic, deriveKey } = useHDWallet()
	const secureStorage = useSecureStorageService()

	return {
		getAllAccounts: () => accounts,
		findAccountByAddress: (address: string) => {
			return accounts.find(a => a.address === address) ?? null
		},
		createAccount: async ({
			walletId,
			account,
			keyIndex,
		}: {
			walletId?: string
			account: number
			keyIndex: number
		}) => {
			const rootWalletId = walletId ?? uuidv7()
			const rootKeyLocation = `rootkey-${rootWalletId}`
			let mnemonic = await secureStorage.getItem(rootKeyLocation)
			if (!mnemonic) {
				const generatedMnemonic = createMnemonic()
                const base64Mnemonic = Buffer.from(generatedMnemonic).toString('base64')
				await secureStorage.setItem(rootKeyLocation, base64Mnemonic)
				mnemonic = base64Mnemonic
			}

			const { address, privateKey } = await deriveKey({
				mnemonic: Buffer.from(mnemonic, 'base64').toString('utf-8'),
				account,
				keyIndex,
				derivationType: BIP32DerivationType.Peikert,
			})

			const id = uuidv7()
			const keyStoreLocation = `pk-${id}`
			await secureStorage.setItem(keyStoreLocation, privateKey)
			const newAccount: WalletAccount = {
				id: uuidv7(),
				address: address,
				type: 'standard',
				hdWalletDetails: {
					walletId: rootWalletId,
					account: account,
					change: 0,
					keyIndex: keyIndex,
					derivationType: BIP32DerivationType.Peikert,
				},
				privateKeyLocation: keyStoreLocation,
			}

			accounts.push(newAccount)
			setAccounts(accounts)

			return newAccount
		},
		addAccount: (account: WalletAccount, privateKey?: string) => {
			accounts.push(account)
			setAccounts(accounts)

			if (privateKey) {
				const storageKey = `pk-${account.address}`
				secureStorage.setItem(storageKey, privateKey)
			}
		},
		updateAccount: (account: WalletAccount, privateKey?: string) => {
			const index = accounts.findIndex(a => a.address === account.address) ?? null
			accounts[index] = account
			setAccounts(accounts)

			if (privateKey) {
				const storageKey = `pk-${account.address}`
				secureStorage.setItem(storageKey, privateKey)
			}
		},
		removeAccountById: (id: string) => {
			const account = accounts.find(a => a.id === id)
			if (account && account.privateKeyLocation) {
				const storageKey = `pk-${account.address}`
				secureStorage.removeItem(storageKey)
			}
			const remaining = accounts.filter(a => a.id !== id)
			setAccounts(remaining)
		},
		removeAccountByAddress: (address: string) => {
			const account = accounts.find(a => a.address === address)
			if (account && account.privateKeyLocation) {
				const storageKey = `pk-${account.address}`
				secureStorage.removeItem(storageKey)
			}
			const remaining = accounts.filter(a => a.address !== address)
			setAccounts(remaining)
		},
	}
}
