import { useMemo } from "react"
import PWIcon from "../common/icons/PWIcon"
import PWView from "../common/view/PWView"
import { useStyles } from "./styles"
import { Text } from "@rneui/themed"

type WebViewTitleBarProps = {
    title: string
    url: string
    onCloseRequested?: () => void
    onReload?: () => void
}

const WebViewTitleBar = ({ title, url, onCloseRequested, onReload }: WebViewTitleBarProps) => {
    const styles = useStyles()

    const domain = useMemo(() => {
        return new URL(url).hostname
    }, [url])

    return (
        <PWView style={styles.titleBar}>
            <PWView style={styles.titleIconContainer}>
                <PWIcon
                    name='cross'
                    onPress={onCloseRequested}
                    variant='primary'
                    size='md'
                />
            </PWView>
            <PWView style={styles.titleBarTextContainer}>
                <Text numberOfLines={1} style={styles.title}>{title}</Text>
                <Text numberOfLines={1} style={styles.url}>{domain}</Text>
            </PWView>
            <PWView style={styles.titleIconContainer}>
                <PWIcon
                    name='reload'
                    onPress={onReload}
                    variant='primary'
                    size='md'
                />
            </PWView>
        </PWView>
    )
}

export default WebViewTitleBar
