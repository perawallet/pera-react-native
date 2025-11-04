import WebView from "react-native-webview"
import useToast from "./toast"
import { config } from "@perawallet/config"
import { Linking } from "react-native"
import { getAccountDisplayName, useAllAccounts, useAppStore, useDeviceInfoService } from "@perawallet/core"
import { ParamListBase, useNavigation } from "@react-navigation/native"
import { NativeStackNavigationProp } from "@react-navigation/native-stack"

type PushNewScreenParams = {
    url: string
}

type PushInternalBrowserParams = {
    url: string
    name?: string
    projectId?: string
    isFavorite?: boolean
}

type OpenSystemBrowserParams = {
    url: string
}

type NotifyUserParams = {
    type: "haptic" | "sound" | "message"
    variant: string
    message?: string
}

type LogAnalyticsParams = {
    name: string,
    payload: unknown
}

type WebviewMessage = {
    action: string,
    params: Record<string, any>
}

export const usePeraWebviewInterface = (webview: WebView | null) => {
    const { showToast } = useToast()
    const accounts = useAllAccounts()
    const deviceID = useAppStore(state => state.deviceID)
    const theme = useAppStore(state => state.theme)
    const network = useAppStore(state => state.network)
    const deviceInfo = useDeviceInfoService()
    const navigation = useNavigation<NativeStackNavigationProp<ParamListBase>>()

    const pushNewScreen = (params: PushNewScreenParams) => {
        //TODO navigate to deeplink
    }
    const pushInternalBrowser = (params: PushInternalBrowserParams) => {
        //TODO add a new webview
    }
    const openSystemBrowser = (params: OpenSystemBrowserParams) => {
        Linking.canOpenURL(params.url).then(supported => {
            if (supported) {
                Linking.openURL(params.url);
            } else {
                showToast({
                    title: "Can't open webpage",
                    body: "The page you're viewing has sent an invalid message format.",
                    type: 'error'
                })
            }
        })
    }

    const notifyUser = (params: NotifyUserParams) => {
        if (params.type === "message") {
            showToast({
                title: "",
                body: params.message ?? "",
                type: 'info'
            })
        }
        //TODO add sound and haptic (and maybe message.banner) support
    }

    const getAddresses = () => {
        const payload = accounts.map(a => ({
            name: getAccountDisplayName(a),
            address: a.address,
            type: "HdKey" //TODO support other types also
        }))
        webview?.postMessage(JSON.stringify(payload))
    }

    const getSettings = () => {
        const payload = accounts.map(a => ({
            //TODO make some more of this configurable and/or add to deviceInfo
            appName: "Pera Wallet",
            appPackageName: "pera-rn",
            appVersion: deviceInfo.getAppVersion(),
            clientType: deviceInfo.getDevicePlatform(),
            deviceId: deviceID,
            deviceVersion: deviceInfo.getDeviceModel(),
            deviceOSVersion: deviceInfo.getDevicePlatform(),
            deviceModel: deviceInfo.getDeviceModel(),
            theme,
            network,
            currency: "USD", //TODO pull from state eventually
            region: "en-US", //TODO pull from state eventually (or device location or something)
            language: "en-US", //TODO pull from app locale
        }))
        webview?.postMessage(JSON.stringify(payload))
    }
    const getPublicSettings = () => {
        const payload = accounts.map(a => ({
            //TODO make some more of this configurable and/or add to deviceInfo
            theme,
            network,
            currency: "USD", //TODO pull from state eventually
            language: "en-US", //TODO pull from app locale
        }))
        webview?.postMessage(JSON.stringify(payload))
    }
    const onBackPressed = () => {
        if (navigation.canGoBack()) {
            navigation.goBack()
        }
    }
    const logAnalyticsEvent = (params: LogAnalyticsParams) => {
        //TODO implement when we have analytics hooked up
    }
    const closeWebView = () => {
        //TODO implement once we figure out how based on how we implement the push functions above
    }

    const handleMessage = ({action, params}: WebviewMessage) => {
        switch(action) {
            case "pushNewScreen": pushNewScreen(params as PushNewScreenParams)
            case "pushInternalBrowser": pushInternalBrowser(params as PushInternalBrowserParams)
            case "openSystemBrowser": openSystemBrowser(params as OpenSystemBrowserParams)
            case "notifyUser": notifyUser(params as NotifyUserParams)
            case "getAddresses": getAddresses()
            case "getSettings": getSettings()
            case "getPublicSettings": getPublicSettings()
            case "onBackPressed": onBackPressed()
            case "logAnalyticsEvent": logAnalyticsEvent(params as LogAnalyticsParams)
            case "closeWebView": closeWebView()
            default: 
                showToast({
                    title: 'Invalid message received.',
                    body: "The page you're viewing has sent an invalid message format.",
                    type: 'error'
                })
        }
    }

    return {
        handleMessage
    }
}