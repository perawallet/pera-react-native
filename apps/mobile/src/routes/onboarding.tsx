import { SCREEN_ANIMATION_CONFIG } from "../constants/ui";
import NavigationHeader from "../components/common/navigation-header/NavigationHeader";
import { createNativeStackNavigator, NativeStackHeaderProps } from "@react-navigation/native-stack";
import OnboardingScreen from "../modules/onboarding/screens/OnboardingScreen";
import NameAccountScreen from "../modules/onboarding/screens/NameAccountScreen";
import ImportAccountScreen from "../modules/onboarding/screens/ImportAccountScreen";
import { screenListeners } from './listeners'

export const OnboardingStack = createNativeStackNavigator({
    initialRouteName: 'OnboardingHome',
    screenOptions: {
        headerShown: false,
        header: (props: NativeStackHeaderProps) => (
            <NavigationHeader {...props} />
        ),
        ...SCREEN_ANIMATION_CONFIG,
    },
    screenListeners,
    screens: {
        OnboardingHome: OnboardingScreen,
        NameAccount: {
            screen: NameAccountScreen,
            options: {
                headerShown: true,
                headerTitle: 'Name your account',
            },
        },
        ImportAccount: {
            screen: ImportAccountScreen,
            options: {
                headerShown: true,
                headerTitle: 'Enter your Recovery Passphrase',
            },
        },
    },
})