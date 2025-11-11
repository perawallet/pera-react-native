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

import { Text, useTheme } from '@rneui/themed';
import MainScreenLayout from '../../layouts/MainScreenLayout';
import {
  AccountWealthHistoryItem,
  formatDatetime,
  useAccountBalances,
  useAppStore,
} from '@perawallet/core';
import { TouchableOpacity } from 'react-native';

import CameraIcon from '../../../assets/icons/camera.svg';
import InboxIcon from '../../../assets/icons/envelope-letter.svg';
import CrossIcon from '../../../assets/icons/cross.svg';

import { useStyles } from './styles';
import { useCallback, useState } from 'react';
import Decimal from 'decimal.js';
import { ScrollView } from 'react-native-gesture-handler';

import CurrencyDisplay from '../../components/common/currency-display/CurrencyDisplay';
import PeraView from '../../components/common/view/PeraView';
import WealthChart from '../../components/common/wealth-chart/WealthChart';
import ButtonPanel from '../../components/account-details/button-panel/ButtonPanel';
import NotificationsIcon from '../../components/common/notifications-icon/NotificationsIcon';
import AccountSelection from '../../components/common/account-selection/AccountSelection';
import AccountMenu from '../../components/account-menu/AccountMenu';
import { Drawer } from 'react-native-drawer-layout';
import QRScannerView from '../../components/common/qr-scanner/QRScannerView';

const AccountScreen = () => {
  const { theme } = useTheme();
  const styles = useStyles();
  const { getSelectedAccount } = useAppStore();
  const account = getSelectedAccount();

  const data = useAccountBalances(account ? [account] : []);
  const [chartData, setChartData] = useState<AccountWealthHistoryItem | null>(
    null,
  );
  const [scrollingEnabled, setScrollingEnabled] = useState<boolean>(true);
  const [scannerVisible, setScannerVisible] = useState<boolean>(false);
  const [drawerOpen, setDrawerOpen] = useState<boolean>(false);

  const loading = data.some(d => !d.isFetched);
  const algoAmount = data.reduce(
    (acc, cur) => acc.plus(cur.algoAmount),
    Decimal(0),
  );
  const usdAmount = data.reduce(
    (acc, cur) => acc.plus(cur.usdAmount),
    Decimal(0),
  );

  const closeQRScanner = () => {
    setScannerVisible(false);
  };

  const openQRScanner = () => {
    setScannerVisible(true);
  };

  const toggleAccountSelectorVisible = () => {
    setDrawerOpen(true);
  };

  const chartSelectionChanged = useCallback(
    (selected: AccountWealthHistoryItem | null) => {
      setChartData(selected);

      if (selected) {
        setScrollingEnabled(false);
      } else {
        setScrollingEnabled(true);
      }
    },
    [setChartData],
  );

  return (
    <Drawer
      open={drawerOpen}
      onOpen={() => setDrawerOpen(true)}
      onClose={() => setDrawerOpen(false)}
      drawerType="front"
      swipeEnabled
      drawerStyle={styles.drawer}
      renderDrawerContent={() => (
        <AccountMenu onSelected={() => setDrawerOpen(false)} showInbox />
      )}
    >
      <MainScreenLayout fullScreen>
        <PeraView style={styles.iconBar}>
          <PeraView style={styles.iconBarSection}>
            <AccountSelection onPress={toggleAccountSelectorVisible} />
          </PeraView>
          <PeraView style={styles.iconBarSection}>
            <TouchableOpacity>
              <InboxIcon style={styles.icon} color={theme.colors.textMain} />
            </TouchableOpacity>
            <TouchableOpacity onPress={openQRScanner}>
              <CameraIcon style={styles.icon} color={theme.colors.textMain} />
            </TouchableOpacity>
            <NotificationsIcon
              style={styles.icon}
              color={theme.colors.textMain}
            />
          </PeraView>
        </PeraView>
        <ScrollView
          scrollEnabled={scrollingEnabled}
          style={styles.webview}
          contentContainerStyle={styles.webviewContent}
        >
          <PeraView style={styles.valueBar}>
            <CurrencyDisplay
              h1
              value={chartData ? Decimal(chartData.algo_value) : algoAmount}
              currency="ALGO"
              precision={2}
              h1Style={styles.primaryCurrency}
              skeleton={loading}
            />
            <PeraView style={styles.secondaryValueBar}>
              <CurrencyDisplay
                h4
                h4Style={styles.valueTitle}
                value={
                  chartData
                    ? Decimal(chartData.value_in_currency ?? '0')
                    : usdAmount
                }
                currency="USD"
                prefix="≈ "
                precision={2}
                skeleton={loading}
              />
              {chartData && (
                <Text h4 h4Style={styles.dateDisplay}>
                  {formatDatetime(chartData.datetime)}
                </Text>
              )}
            </PeraView>
          </PeraView>

          {!!account && (
            <WealthChart
              account={account}
              onSelectionChanged={chartSelectionChanged}
            />
          )}

          <ButtonPanel />
        </ScrollView>
      </MainScreenLayout>
      <QRScannerView
        visible={scannerVisible}
        onSuccess={closeQRScanner}
        animationType="slide"
      >
        <TouchableOpacity onPress={closeQRScanner} style={styles.scannerClose}>
          <CrossIcon color={theme.colors.textWhite} />
        </TouchableOpacity>
      </QRScannerView>
    </Drawer>
  );
};

export default AccountScreen;
