import { PropsWithChildren } from "react"
import { View, ViewProps } from "react-native"
import { useStyles } from "./MainScreenLayout.style"
import { Networks, useAppStore } from "@perawallet/core"
import { SafeAreaView } from "react-native-safe-area-context"
import PeraView from "../components/view/PeraView"

export type MainScreenLayoutProps = {
    fullScreen?: boolean
} & ViewProps

const MainScreenLayout = (props: MainScreenLayoutProps) => {
    const styles = useStyles()
    const network = useAppStore((state) => state.network)

    return props.fullScreen ? (
        <PeraView style={[props.style, styles.mainContainer]} {...props}>
            {network === Networks.testnet && <View style={styles.testnetContainer} />}

            {props.children}
        </PeraView>
    ) : (
        <SafeAreaView style={[props.style, styles.mainContainer]} {...props}>
            {network === Networks.testnet && <View style={styles.testnetContainer} />}

            {props.children}
        </SafeAreaView>
    )
}
    

export default MainScreenLayout