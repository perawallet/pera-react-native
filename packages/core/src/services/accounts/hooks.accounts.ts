import { useAppStore } from '../../store'
import { useSecureStorageService } from '../storage'
import type { WalletAccount } from './types'
import { BIP32DerivationTypes } from '@perawallet/xhdwallet'
import { v7 as uuidv7 } from 'uuid'
import { useHDWallet } from './hooks.hdwallet'
import { decodeFromBase64, encodeToBase64 } from '../../utils/strings'
import { encodeAlgorandAddress } from '../blockchain'
import {
    useV1DevicesPartialUpdate,
    v1AccountsAssetsList,
    v1AccountsAssetsListQueryKey,
    type AccountDetailAssetSerializerResponse,
} from '../../api/generated/backend'
import Decimal from 'decimal.js'
import { useDeviceID, useDeviceInfoService } from '../device'
import { useQueries } from '@tanstack/react-query'

// Services relating to locally stored accounts
export const useAllAccounts = () => {
    const accounts = useAppStore(state => state.accounts)
    return accounts
}

export const useHasAccounts = () => {
    const accounts = useAppStore(state => state.accounts)
    return !!accounts?.length
}

export const useHasNoAccounts = () => {
    const accounts = useAppStore(state => state.accounts)
    return !accounts?.length
}

export const useFindAccountbyAddress = (address: string) => {
    const accounts = useAppStore(state => state.accounts)
    return accounts.find(a => a.address === address) ?? null
}

export const useTransactionSigner = () => {
    const accounts = useAppStore(state => state.accounts)
    const { signTransaction } = useHDWallet()
    const secureStorage = useSecureStorageService()
    const signTransactionForAddress = async (address: string, transaction: Buffer): Promise<Uint8Array> => {
        const account =  accounts.find(a => a.address === address) ?? null
        const hdWalletDetails = account?.hdWalletDetails

        if (!hdWalletDetails) {
            return Promise.reject(`No HD wallet found for ${address}`)
        }

        const storageKey = `pk-${account.address}`
        const mnemonicBase64 = await secureStorage.getItem(storageKey)

        if (!mnemonicBase64) {
            return Promise.reject(`No signing keys found for ${address}`)
        }

        const mnemonic = decodeFromBase64(mnemonicBase64).toString()
        return signTransaction(mnemonic, hdWalletDetails, transaction)
    }

    return {
        signTransactionForAddress
    }
}

export const useCreateAccount = () => {
    const deviceID = useDeviceID()
    const accounts = useAppStore(state => state.accounts)
    const { createMnemonic, deriveKey } = useHDWallet()
    const secureStorage = useSecureStorageService()
    const setAccounts = useAppStore(state => state.setAccounts)
    const deviceInfo = useDeviceInfoService()
    const { mutateAsync: updateDeviceOnBackend } = useV1DevicesPartialUpdate()

    return async ({
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
            const base64Mnemonic = encodeToBase64(
                Buffer.from(generatedMnemonic),
            )
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
        await secureStorage.setItem(
            keyStoreLocation,
            encodeToBase64(privateKey),
        )
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
        setAccounts([...accounts])

        if (deviceID) {
            updateDeviceOnBackend({
                device_id: deviceID,
                data: {
                    platform: deviceInfo.getDevicePlatform(),
                    accounts: accounts.map(a => a.address),
                },
            })
        }
        return newAccount
    }
}

export const useImportWallet = () => {
    const accounts = useAppStore(state => state.accounts)
    const { deriveKey } = useHDWallet()
    const secureStorage = useSecureStorageService()
    const setAccounts = useAppStore(state => state.setAccounts)
    const deviceID = useDeviceID()
    const deviceInfo = useDeviceInfoService()
    const { mutateAsync: updateDeviceOnBackend } = useV1DevicesPartialUpdate()

    return async ({
        walletId,
        mnemonic,
    }: {
        walletId?: string
        mnemonic: string
    }) => {
        const rootWalletId = walletId ?? uuidv7()
        const rootKeyLocation = `rootkey-${rootWalletId}`
        const base64Mnemonic = encodeToBase64(Buffer.from(mnemonic))
        secureStorage.setItem(rootKeyLocation, base64Mnemonic)

        //TODO: we currently just create the 0/0 account but we really should scan the blockchain
        //and look for accounts that might match (see old app logic - we want to scan iteratively
        //until we find 5 empty keyindexes and 5 empty accounts (I think)
        const { address, privateKey } = await deriveKey({
            mnemonic: mnemonic,
            account: 0,
            keyIndex: 0,
            derivationType: BIP32DerivationTypes.Peikert,
        })

        const id = uuidv7()
        const keyStoreLocation = `pk-${id}`
        await secureStorage.setItem(
            keyStoreLocation,
            encodeToBase64(privateKey),
        )
        const newAccount: WalletAccount = {
            id: uuidv7(),
            address: encodeAlgorandAddress(address),
            type: 'standard',
            hdWalletDetails: {
                walletId: rootWalletId,
                account: 0,
                change: 0,
                keyIndex: 0,
                derivationType: BIP32DerivationTypes.Peikert,
            },
            privateKeyLocation: keyStoreLocation,
        }

        accounts.push(newAccount)
        setAccounts([...accounts])

        if (deviceID) {
            updateDeviceOnBackend({
                device_id: deviceID,
                data: {
                    platform: deviceInfo.getDevicePlatform(),
                    accounts: accounts.map(a => a.address),
                },
            })
        }
        return newAccount
    }
}

export const useUpdateAccount = () => {
    const accounts = useAppStore(state => state.accounts)
    const secureStorage = useSecureStorageService()
    const setAccounts = useAppStore(state => state.setAccounts)
    const deviceID = useDeviceID()
    const deviceInfo = useDeviceInfoService()
    const { mutateAsync: updateDeviceOnBackend } = useV1DevicesPartialUpdate()

    return (account: WalletAccount, privateKey?: string) => {
        const index =
            accounts.findIndex(a => a.address === account.address) ?? null
        accounts[index] = account
        setAccounts([...accounts])

        if (privateKey) {
            const storageKey = `pk-${account.address}`
            secureStorage.setItem(storageKey, privateKey)
        }

        if (deviceID) {
            updateDeviceOnBackend({
                device_id: deviceID,
                data: {
                    platform: deviceInfo.getDevicePlatform(),
                    accounts: accounts.map(a => a.address),
                },
            })
        }
    }
}

export const useAddAccount = () => {
    const accounts = useAppStore(state => state.accounts)
    const secureStorage = useSecureStorageService()
    const setAccounts = useAppStore(state => state.setAccounts)
    const deviceID = useDeviceID()
    const deviceInfo = useDeviceInfoService()
    const { mutateAsync: updateDeviceOnBackend } = useV1DevicesPartialUpdate()

    return (account: WalletAccount, privateKey?: string) => {
        accounts.push(account)
        setAccounts([...accounts])

        if (privateKey) {
            const storageKey = `pk-${account.address}`
            secureStorage.setItem(storageKey, privateKey)
        }

        if (deviceID) {
            updateDeviceOnBackend({
                device_id: deviceID,
                data: {
                    platform: deviceInfo.getDevicePlatform(),
                    accounts: accounts.map(a => a.address),
                },
            })
        }
    }
}

export const useRemoveAccountById = () => {
    const accounts = useAppStore(state => state.accounts)
    const secureStorage = useSecureStorageService()
    const setAccounts = useAppStore(state => state.setAccounts)

    return (id: string) => {
        const account = accounts.find(a => a.id === id)
        if (account && account.privateKeyLocation) {
            const storageKey = `pk-${account.address}`
            secureStorage.removeItem(storageKey)
        }
        const remaining = accounts.filter(a => a.id !== id)
        setAccounts([...remaining])
    }
}

export const useAccountBalances = (accounts: WalletAccount[]) => {
    const results = useQueries({
        queries: accounts.map(acc => {
            const address = acc.address
            return {
                queryKey: v1AccountsAssetsListQueryKey(
                    { account_address: address },
                    { include_algo: true },
                ),
                queryFn: () =>
                    v1AccountsAssetsList({
                        account_address: address,
                        params: { include_algo: true },
                    }),
            }
        }),
    })

    return results.map(r => {
        const accountInfo = r.data
        let algoAmount = Decimal(0)
        let usdAmount = Decimal(0)

        if (accountInfo) {
            accountInfo.results.forEach(
                (data: AccountDetailAssetSerializerResponse) => {
                    algoAmount = algoAmount.plus(
                        Decimal(data.amount ?? '0').div(
                            Decimal(10).pow(data.fraction_decimals),
                        ),
                    )
                    usdAmount = usdAmount.plus(
                        Decimal(data.balance_usd_value ?? '0'),
                    )
                },
            )
        }

        return {
            algoAmount: algoAmount,
            usdAmount: usdAmount,
            isPending: r.isPending,
            isFetched: r.isFetched,
            isRefetching: r.isRefetching,
            isError: r.isError,
        }
    })
}
