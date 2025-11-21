import { useMemo } from "react"
import { useV1DevicesNotificationStatusList, v1DevicesNotificationStatusListQueryKey } from "../../api/index"
import { useDeviceID } from "../../services/device"
import { config } from "@perawallet/config"

export const useNotificationStatusQueryKeys = () => {
    const deviceID = useDeviceID()
    return deviceID ? [
        v1DevicesNotificationStatusListQueryKey({ device_id: deviceID })
    ] : []
}

export const useNotificationStatus = () => {
    const deviceID = useDeviceID()
    const { data } = useV1DevicesNotificationStatusList(
        {
            device_id: deviceID!,
        },
        {
            query: {
                enabled: !!deviceID,
                staleTime: config.notificationRefreshTime,
            },
        },
    )

    return useMemo<{
        hasNotifications: boolean
    }>(() => ({
        hasNotifications: data?.has_new_notification ?? false
    }), [data?.has_new_notification])
}