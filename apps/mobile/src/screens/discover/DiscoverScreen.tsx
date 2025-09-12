import { Text, View } from "react-native"
import { styles } from './styles'
import { SafeAreaView } from "react-native-safe-area-context"

const DiscoverScreen = () => {
    return (
        <SafeAreaView style={styles.container}>
            <View>
                <Text>This will be the discover screen</Text>
            </View>
        </SafeAreaView>
    )
}

export default DiscoverScreen