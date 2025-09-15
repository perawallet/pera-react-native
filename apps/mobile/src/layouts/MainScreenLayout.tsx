import { PropsWithChildren } from "react"
import { View } from "react-native"
import { useStyles } from "./MainScreenLayout.style"
import { Networks, useAppStore } from "@perawallet/core"
import { SafeAreaView } from "react-native-safe-area-context"

const MainScreenLayout = ({children}: PropsWithChildren) => {
    const styles = useStyles()
    const network = useAppStore((state) => state.network)

    return (
        <SafeAreaView style={styles.mainContainer}>
            {network === Networks.testnet && <View style={styles.testnetContainer} />}

            {children}
        </SafeAreaView>
    )
}
    

export default MainScreenLayout