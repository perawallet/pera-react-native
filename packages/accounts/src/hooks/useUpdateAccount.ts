import { useDeviceID, useDeviceInfoService, useNetwork, useUpdateDeviceMutation } from "@perawallet/wallet-core-platform-integration"
import { useAccountsStore } from "../store"
import { WalletAccount } from "../models"

export const useUpdateAccount = () => {
    const accounts = useAccountsStore(state => state.accounts)
    const setAccounts = useAccountsStore(state => state.setAccounts)
    const { network } = useNetwork()
    const deviceID = useDeviceID(network)
    const deviceInfo = useDeviceInfoService()
    const { mutateAsync: updateDeviceOnBackend } = useUpdateDeviceMutation()

    return (account: WalletAccount) => {
        const index =
            accounts.findIndex(a => a.address === account.address) ?? null
        accounts[index] = account
        setAccounts([...accounts])

        if (deviceID) {
            updateDeviceOnBackend({
                deviceId: deviceID,
                data: {
                    platform: deviceInfo.getDevicePlatform(),
                    accounts: accounts.map(a => a.address),
                },
            })
        }
    }
}