import { Network } from "@perawallet/wallet-core-shared"

const MODULE_PREFIX = 'notifications'

export const getNotificationsListQueryKey = (
    network: Network,
    deviceID: string,
) => {
    return [MODULE_PREFIX, 'list', { deviceID, network }]
}