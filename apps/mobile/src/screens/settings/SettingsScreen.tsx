/*
 Copyright 2022-2025 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
 */

import { Text } from '@rneui/themed';
import MainScreenLayout from '../../layouts/MainScreenLayout';

import PWView from '../../components/common/view/PWView';
import PWButton from '../../components/common/button/PWButton';
import { useStyles } from './styles';
import { ScrollView } from 'react-native';
import { ParamListBase, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useDeviceInfoService } from '@perawallet/core';
import { useMemo } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import PWTouchableOpacity from '../../components/common/touchable-opacity/PWTouchableOpacity';

import ChevronRight from '../../../assets/icons/chevron-right.svg';
import ShieldIcon from '../../../assets/icons/gear.svg';
import DollarIcon from '../../../assets/icons/dollar.svg';
import MoonIcon from '../../../assets/icons/moon.svg';

//TODO: build out all the settins pages
const settingsOptions = [
  {
    title: 'Account',
    items: [
      { route: 'SettingsSubPage', icon: <ShieldIcon />, title: 'Security' },
      {
        route: 'SettingsSubPage',
        icon: <ShieldIcon />,
        title: 'Notifications'
      },
      {
        route: 'SettingsSubPage',
        icon: <ShieldIcon />,
        title: 'WalletConnect Sessions'
      }
    ]
  },
  {
    title: 'App Preferences',
    items: [
      { route: 'Currency', icon: <DollarIcon />, title: 'Currency' },
      { route: 'Theme', icon: <MoonIcon />, title: 'Theme' }
    ]
  },
  {
    title: 'Support',
    items: [
      { route: 'SettingsSubPage', icon: <ShieldIcon />, title: 'Get Help' },
      {
        route: 'SettingsSubPage',
        icon: <ShieldIcon />,
        title: 'Rate Pera Wallet'
      },
      {
        route: 'SettingsSubPage',
        icon: <ShieldIcon />,
        title: 'Terms and Services'
      },
      {
        route: 'SettingsSubPage',
        icon: <ShieldIcon />,
        title: 'Privacy Policy'
      },
      {
        route: 'SettingsSubPage',
        icon: <ShieldIcon />,
        title: 'Developer Settings'
      }
    ]
  }
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
    <MainScreenLayout fullScreen>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollViewContainer}
      >
        <PWView style={styles.sectionContainer}>
          {settingsOptions.map(item => (
            <PWView
              style={styles.section}
              key={`settings-section-${item.title}`}
            >
              <Text style={styles.sectionTitle}>{item.title}</Text>
              {item.items.map(page => (
                <PWTouchableOpacity
                  style={styles.sectionRow}
                  key={`settings-sectionrow-${page.title}`}
                  onPress={() => goToSettingsPage(page.route, page.title)}
                >
                  {page.icon}
                  <Text style={styles.sectionRowTitle}>{page.title}</Text>
                  <ChevronRight />
                </PWTouchableOpacity>
              ))}
            </PWView>
          ))}
        </PWView>
        <PWButton variant="tertiary" title="Remove All Accounts and Logout" />
        <Text style={styles.versionText}>Pera Wallet Version {appVersion}</Text>
      </ScrollView>
    </MainScreenLayout>
  );
};

export default SettingsScreen;
