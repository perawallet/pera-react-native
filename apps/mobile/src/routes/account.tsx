import { createNativeStackNavigator, NativeStackHeaderProps } from "@react-navigation/native-stack";
import { SCREEN_ANIMATION_CONFIG } from "../constants/ui";
import { screenListeners } from "./listeners";
import AccountScreen from "../modules/account-details/screens/AccountScreen";
import AssetDetailsScreen from "../modules/asset-details/screens/AssetDetailsScreen";
import NavigationHeader from "../components/common/navigation-header/NavigationHeader";

export const AccountStack = createNativeStackNavigator({
    initialRouteName: 'AccountDetails',
    screenOptions: {
        headerShown: false,
        ...SCREEN_ANIMATION_CONFIG,
    },
    screenListeners,
    screens: {
        AccountDetails: AccountScreen,
        AssetDetails: {
            screen: AssetDetailsScreen,
            options: {
                headerShown: true,
                header: (props: NativeStackHeaderProps) => (
                    <NavigationHeader {...props} />
                ),
            },
        },
    },
})