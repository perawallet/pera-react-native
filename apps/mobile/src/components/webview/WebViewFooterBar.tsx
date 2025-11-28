import { RefObject, useCallback, useLayoutEffect, useMemo, useState } from "react"
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
    const [returningHome, setReturningHome] = useState(false)

    const isHome = useMemo(() => {
        return !navigationState || navigationState.url === homeUrl
    }, [navigationState, homeUrl])

    //HACK: this is a little messy - there's no way seemingly to navigate directly to a URL, so we just 
    //go back all the way through the history
    useLayoutEffect(() => {
        if (returningHome) {
            if (navigationState?.canGoBack) {
                webview.current?.goBack()
            } else {
                setReturningHome(false)
            }
        }
    }, [returningHome, webview, navigationState])

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
            setReturningHome(true)
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
