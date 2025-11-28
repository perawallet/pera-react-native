import { RefObject, useCallback, useMemo } from "react"
import PWView from "../common/view/PWView"
import { useStyles } from "./styles"
import PWIcon from "../common/icons/PWIcon"
import WebView from "react-native-webview"
import { WebViewNativeEvent } from "react-native-webview/lib/RNCWebViewNativeComponent"
import { debugLog } from "@perawallet/wallet-core-shared"

type WebViewFooterBarProps = {
    webview: RefObject<WebView<{}> | null>
    homeUrl?: string
    navigationState?: WebViewNativeEvent
}

const WebViewFooterBar = ({ webview, homeUrl, navigationState }: WebViewFooterBarProps) => {
    const styles = useStyles()

    const isHome = useMemo(() => {
        return !navigationState || navigationState.url === homeUrl
    }, [navigationState, homeUrl])

    const onBackRequested = useCallback(() => {
        if (navigationState?.canGoBack) {
            webview.current?.goBack()
        }
    }, [webview, navigationState])

    const onForwardRequested = useCallback(() => {
        if (navigationState?.canGoForward) {
            webview.current?.goForward()
        }
    }, [webview, navigationState])

    const onHomeRequested = useCallback(() => {
        if (navigationState && !isHome) {
            webview.current?.reload()
        }
    }, [webview, navigationState, isHome])

    const onFavoriteRequested = useCallback(() => {
        // TODO: Implement favorite
    }, [webview])

    return (
        <PWView style={styles.footerBar}>
            <PWIcon
                name='chevron-left'
                onPress={onBackRequested}
                variant='primary'
                disabled={!navigationState?.canGoBack}
            />
            <PWIcon
                name='chevron-right'
                onPress={onForwardRequested}
                variant='primary'
                disabled={!navigationState?.canGoForward}
            />
            <PWIcon
                name='house'
                onPress={onHomeRequested}
                variant='primary'
                disabled={isHome}
            />
            <PWIcon
                name='star'
                onPress={onFavoriteRequested}
                variant='primary'
            />
        </PWView>
    )
}

export default WebViewFooterBar
