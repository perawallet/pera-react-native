import { Text } from '@rneui/themed';
import MainScreenLayout from '../../layouts/MainScreenLayout';

import PeraView from '../../components/common/view/PeraView';
import PeraButton from '../../components/common/button/PeraButton';
import { useStyles } from './styles';
import { ScrollView, TouchableOpacity } from 'react-native';
import { ParamListBase, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

import ChevronRight from '../../../assets/icons/chevron-right.svg';
import ShieldIcon from '../../../assets/icons/gear.svg';
import { useDeviceInfoService } from '@perawallet/core';
import { useMemo } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

//TODO: build out all the settins pages
const settingsOptions = [
  {
    title: 'Account',
    items: [
      { route: 'SettingsSubPage', icon: <ShieldIcon />, title: 'Security' },
      { route: 'SettingsSubPage', icon: <ShieldIcon />, title: 'Contacts' },
      {
        route: 'SettingsSubPage',
        icon: <ShieldIcon />,
        title: 'Notifications',
      },
      {
        route: 'SettingsSubPage',
        icon: <ShieldIcon />,
        title: 'WalletConnect Sessions',
      },
    ],
  },
  {
    title: 'App Preferences',
    items: [
      { route: 'SettingsSubPage', icon: <ShieldIcon />, title: 'Currency' },
      { route: 'SettingsSubPage', icon: <ShieldIcon />, title: 'Theme' },
    ],
  },
  {
    title: 'Support',
    items: [
      { route: 'SettingsSubPage', icon: <ShieldIcon />, title: 'Get Help' },
      {
        route: 'SettingsSubPage',
        icon: <ShieldIcon />,
        title: 'Rate Pera Wallet',
      },
      {
        route: 'SettingsSubPage',
        icon: <ShieldIcon />,
        title: 'Terms and Services',
      },
      {
        route: 'SettingsSubPage',
        icon: <ShieldIcon />,
        title: 'Privacy Policy',
      },
      {
        route: 'SettingsSubPage',
        icon: <ShieldIcon />,
        title: 'Developer Settings',
      },
    ],
  },
];

const SettingsScreen = () => {
  const insets = useSafeAreaInsets();
  const styles = useStyles(insets);
  const navigation = useNavigation<NativeStackNavigationProp<ParamListBase>>();
  const { getAppVersion } = useDeviceInfoService();

  const appVersion = useMemo(() => {
    return getAppVersion();
  }, [getAppVersion]);

  const goToSettingsPage = (route: string, title: string) => {
    navigation.push(route, { title });
  };

  return (
    <MainScreenLayout header fullScreen>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollViewContainer}
      >
        <PeraView style={styles.sectionContainer}>
          {settingsOptions.map(item => (
            <PeraView
              style={styles.section}
              key={`settings-section-${item.title}`}
            >
              <Text style={styles.sectionTitle}>{item.title}</Text>
              {item.items.map(page => (
                <TouchableOpacity
                  style={styles.sectionRow}
                  key={`settings-sectionrow-${page.title}`}
                  onPress={() => goToSettingsPage(page.route, page.title)}
                >
                  {page.icon}
                  <Text style={styles.sectionRowTitle}>{page.title}</Text>
                  <ChevronRight />
                </TouchableOpacity>
              ))}
            </PeraView>
          ))}
        </PeraView>
        <PeraButton variant="tertiary" title="Remove All Accounts and Logout" />
        <Text style={styles.versionText}>Pera Wallet Version {appVersion}</Text>
      </ScrollView>
    </MainScreenLayout>
  );
};

export default SettingsScreen;
