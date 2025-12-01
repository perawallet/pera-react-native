import { SCREEN_ANIMATION_CONFIG } from "../constants/ui";
import NavigationHeader from "../components/common/navigation-header/NavigationHeader";
import { createNativeStackNavigator, NativeStackHeaderProps } from "@react-navigation/native-stack";
import { screenListeners } from "./listeners";
import SettingsScreen from "../modules/settings/screens/SettingsScreen";
import SettingsSecurityScreen from "../modules/settings/screens/security/SettingsSecurtyScreen";
import SettingsNotificationsScreen from "../modules/settings/screens/notifications/SettingsNotificationsScreen";
import SettingsWalletConnectScreen from "../modules/settings/screens/wallet-connect/SettingsWalletConnectScreen";
import SettingsPasskeyScreen from "../modules/settings/screens/passkeys/SettingsPasskeysScreen";
import SettingsCurrencyScreen from "../modules/settings/screens/currency/SettingsCurrencyScreen";
import SettingsThemeScreen from "../modules/settings/screens/theme/SettingsThemeScreen";
import SettingsGetHelpScreen from "../modules/settings/screens/get-help/SettingsGetHelpScreen";
import SettingsTermsAndServicsScreen from "../modules/settings/screens/terms-and-services/SettingsTermsAndServicesScreen";
import SettingsPrivacyPolicyScreen from "../modules/settings/screens/privacy-policy/SettingsPrivacyPolicyScreen";
import SettingsDeveloperScreen from "../modules/settings/screens/developer/SettingsDeveloperScreen";
import SettingsSubPageScreen from "../modules/settings/screens/SettingsSubPageScreen";

export const SettingsStack = createNativeStackNavigator({
    initialRouteName: 'SettingsHome',
    screenOptions: {
        headerShown: true,
        header: (props: NativeStackHeaderProps) => (
            <NavigationHeader {...props} />
        ),
        ...SCREEN_ANIMATION_CONFIG,
    },
    screenListeners,
    screens: {
        SettingsHome: {
            screen: SettingsScreen,
            options: {
                title: 'Settings',
            },
        },
        SecuritySettings: {
            screen: SettingsSecurityScreen,
            options: {
                title: 'Security',
            },
        },
        NotificationsSettings: {
            screen: SettingsNotificationsScreen,
            options: {
                title: 'Notifications',
            },
        },
        WalletConnectSettings: {
            screen: SettingsWalletConnectScreen,
            options: {
                title: 'Wallet Connect',
            },
        },
        PasskeysSettings: {
            screen: SettingsPasskeyScreen,
            options: {
                title: 'Passkeys',
            },
        },
        CurrencySettings: {
            screen: SettingsCurrencyScreen,
            options: {
                title: 'Currency',
            },
        },
        ThemeSettings: {
            screen: SettingsThemeScreen,
            options: {
                title: 'Theme',
            },
        },
        GetHelpSettings: {
            screen: SettingsGetHelpScreen,
            options: {
                title: 'Get Help',
            },
        },
        TermsAndServicesSettings: {
            screen: SettingsTermsAndServicsScreen,
            options: {
                title: 'Terms and Services',
            },
        },
        PrivacyPolicySettings: {
            screen: SettingsPrivacyPolicyScreen,
            options: {
                title: 'Privacy Policy',
            },
        },
        DeveloperSettings: {
            screen: SettingsDeveloperScreen,
            options: {
                title: 'Developer',
            },
        },
        SettingsSubPage: {
            screen: SettingsSubPageScreen,
            //TODO fix types here
            //eslint-disable-next-line @typescript-eslint/no-explicit-any
            options: ({ route }: any) => ({
                title: route.params?.title,
            }),
        },
    },
})