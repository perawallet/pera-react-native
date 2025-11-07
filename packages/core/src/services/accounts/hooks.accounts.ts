import { useAppStore } from '../../store'
import { useSecureStorageService } from '../storage'
import type { WalletAccount } from './types'
import { BIP32DerivationTypes } from '@perawallet/xhdwallet'
import { v7 as uuidv7 } from 'uuid'
import { useHDWallet } from './hooks.hdwallet'
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
import { withKey } from './utils'

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

        const storageKey = `rootkey-${hdWalletDetails.walletId}`
        return withKey(storageKey, secureStorage, async (keyData) => {
            if (!keyData) {
                return Promise.reject(`No signing keys found for ${address}`)
            }

            let seed: Buffer
            try {
                // Try to parse as JSON first (new format)
                const masterKey = JSON.parse(keyData.toString())
                seed = Buffer.from(masterKey.seed, 'base64')
            } catch {
                // Fall back to treating it as raw seed data (old format or tests)
                seed = keyData
            }
            return signTransaction(seed, hdWalletDetails, transaction)

        })
    }

    return {
        signTransactionForAddress
    }
}

export const useCreateAccount = () => {
    const deviceID = useDeviceID()
    const accounts = useAppStore(state => state.accounts)
    const { generateMasterKey, deriveKey } = useHDWallet()
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
        const masterKey = await withKey(rootKeyLocation, secureStorage, async (key) => {
            if (!key) {
                const masterKey = await generateMasterKey()
                const base64Seed = masterKey.seed.toString('base64')
                const stringifiedObj = JSON.stringify({
                    seed: base64Seed,
                    entropy: masterKey.entropy
                })
                await secureStorage.setItem(rootKeyLocation, Buffer.from(stringifiedObj))
                return JSON.parse(stringifiedObj)
            }

            // Try to parse as JSON first (new format)
            return JSON.parse(key.toString())
        })

        if (!masterKey?.seed) {
            throw Error(`No key found for ${rootWalletId}`)
        }

        const { address, privateKey } = await deriveKey({
            seed: Buffer.from(masterKey.seed, 'base64'),
            account,
            keyIndex,
            derivationType: BIP32DerivationTypes.Peikert,
        })

        const id = uuidv7()
        const keyStoreLocation = `pk-${id}`
        const keyBuffer = Buffer.from(privateKey)
        await secureStorage.setItem(
            keyStoreLocation,
            keyBuffer,
        )

        keyBuffer.fill(0)
        privateKey.fill(0)

        const newAccount: WalletAccount = {
            id: uuidv7(),
            address: encodeAlgorandAddress(address),
            type: 'standard',
            canSign: true,
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
    const { generateMasterKey, deriveKey } = useHDWallet()
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
        const masterKey = await generateMasterKey(mnemonic)
        const base64Seed = masterKey.seed.toString('base64')
        const stringifiedObj = JSON.stringify({
            seed: base64Seed,
            entropy: masterKey.entropy
        })
        await secureStorage.setItem(rootKeyLocation, Buffer.from(stringifiedObj))

        //TODO: we currently just create the 0/0 account but we really should scan the blockchain
        //and look for accounts that might match (see old app logic - we want to scan iteratively
        //until we find 5 empty keyindexes and 5 empty accounts (I think)
        const { address, privateKey } = await deriveKey({
            seed: masterKey.seed,
            account: 0,
            keyIndex: 0,
            derivationType: BIP32DerivationTypes.Peikert,
        })

        const id = uuidv7()
        const keyStoreLocation = `pk-${id}`
        const keyBuffer = Buffer.from(privateKey)
        await secureStorage.setItem(
            keyStoreLocation,
            keyBuffer,
        )
        keyBuffer.fill(0)
        privateKey.fill(0)
        const newAccount: WalletAccount = {
            id: uuidv7(),
            address: encodeAlgorandAddress(address),
            type: 'standard',
            canSign: true,
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
    const setAccounts = useAppStore(state => state.setAccounts)
    const deviceID = useDeviceID()
    const deviceInfo = useDeviceInfoService()
    const { mutateAsync: updateDeviceOnBackend } = useV1DevicesPartialUpdate()

    return (account: WalletAccount) => {
        const index =
            accounts.findIndex(a => a.address === account.address) ?? null
        accounts[index] = account
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
    }
}

export const useAddAccount = () => {
    const accounts = useAppStore(state => state.accounts)
    const secureStorage = useSecureStorageService()
    const setAccounts = useAppStore(state => state.setAccounts)
    const deviceID = useDeviceID()
    const deviceInfo = useDeviceInfoService()
    const { mutateAsync: updateDeviceOnBackend } = useV1DevicesPartialUpdate()
    const { deriveKey } = useHDWallet()

    return async (account: WalletAccount) => {
        if (account.type === 'standard' && account.hdWalletDetails) {
            const rootWalletId = account.hdWalletDetails.walletId
            const rootKeyLocation = `rootkey-${rootWalletId}`
            const masterKey = await withKey(rootKeyLocation, secureStorage, async (key) => {
                if (!key) {
                    throw Error(`No key found for ${rootWalletId}`)
                }

                return JSON.parse(key.toString())
            })

            if (!masterKey?.seed) {
                throw Error(`No key found for ${rootWalletId}`)
            }
            const { address, privateKey } = await deriveKey({
                seed: Buffer.from(masterKey.seed, 'base64'),
                account: account.hdWalletDetails!.account,
                keyIndex: account.hdWalletDetails!.keyIndex,
                derivationType: BIP32DerivationTypes.Peikert,
            })
            const id = uuidv7()
            account.address = encodeAlgorandAddress(address)
            account.id = id

            const keyStoreLocation = `pk-${id}`
            const keyBuffer = Buffer.from(privateKey)
            await secureStorage.setItem(
                keyStoreLocation,
                keyBuffer,
            )
            keyBuffer.fill(0)
            privateKey.fill(0)
        }

        accounts.push(account)
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
