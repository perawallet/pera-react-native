import type { BIP32DerivationType } from '@algorandfoundation/xhd-wallet-api'

export const AccountTypes = {
	standard: 'standard',
	ledger: 'ledger',
	multisig: 'multisig',
} as const

export type AccountType = (typeof AccountTypes)[keyof typeof AccountTypes]

export interface HDWalletDetails {
	walletId: string
	account: number
	change: number
	keyIndex: number
	derivationType: BIP32DerivationType
}

export interface MultiSigDetails {
	threshold: number
	addresses: string[]
}

export interface WalletAccount {
	id: string
	name?: string
	type: AccountType
	address: string
	privateKeyLocation?: string
	hdWalletDetails?: HDWalletDetails
	multisigDetails?: MultiSigDetails
}
