import { Text } from "@rneui/themed"
import MainScreenLayout from "../../layouts/MainScreenLayout"

import { useStyles } from "./styles"
import { StaticScreenProps } from "@react-navigation/native"
import { useSafeAreaInsets } from "react-native-safe-area-context"

type SettingsSubPageScreenProps = StaticScreenProps<{
  title: string;
}>;

const SettingsSubPageScreen = ({ route }: SettingsSubPageScreenProps) => {
    const insets = useSafeAreaInsets()
    const styles = useStyles(insets)

    return <MainScreenLayout header fullScreen>
            <Text>This page would hold the settings for {route.params.title}</Text>
    </MainScreenLayout>
}

export default SettingsSubPageScreen