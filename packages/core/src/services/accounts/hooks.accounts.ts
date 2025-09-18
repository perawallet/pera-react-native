import { useAppStore } from '../../store'
import { useSecureStorageService } from '../storage'
import type { WalletAccount } from './types'
import { BIP32DerivationTypes } from '@perawallet/xhdwallet'
import { v7 as uuidv7 } from 'uuid'
import { useHDWallet } from './hooks.hdwallet'
import { decodeFromBase64, encodeToBase64 } from '../../utils/string-encoding'
import { encodeAlgorandAddress } from '../blockchain'

const MAX_ADDRESS_DISPLAY = 11
const ADDRESS_DISPLAY_PREFIX_LENGTH = 5

export const useDisplayAddress = (account: WalletAccount) => {
	if (account.name) return account.name
	if (!account.address) return 'No Address Found'
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
				const base64Mnemonic = encodeToBase64(Buffer.from(generatedMnemonic))
				await secureStorage.setItem(rootKeyLocation, base64Mnemonic)
				mnemonic = base64Mnemonic
			}

			const { address, privateKey } = await deriveKey({
				mnemonic: decodeFromBase64(mnemonic).toString(),
				account,
				keyIndex,
				derivationType: BIP32DerivationTypes.Peikert,
			})

			const id = uuidv7()
			const keyStoreLocation = `pk-${id}`
			await secureStorage.setItem(keyStoreLocation, encodeToBase64(privateKey))
			const newAccount: WalletAccount = {
				id: uuidv7(),
				address: encodeAlgorandAddress(address),
				type: 'standard',
				hdWalletDetails: {
					walletId: rootWalletId,
					account: account,
					change: 0,
					keyIndex: keyIndex,
					derivationType: BIP32DerivationTypes.Peikert,
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
