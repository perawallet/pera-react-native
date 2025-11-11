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

import CameraIcon from '../../../assets/icons/camera.svg';
import CrossIcon from '../../../assets/icons/cross.svg';

import { useStyles } from './styles';
import { useCallback, useState } from 'react';
import Decimal from 'decimal.js';
import { ScrollView } from 'react-native-gesture-handler';

import CurrencyDisplay from '../../components/common/currency-display/CurrencyDisplay';
import PWView from '../../components/common/view/PWView';
import WealthChart from '../../components/common/wealth-chart/WealthChart';
import ButtonPanel from '../../components/account-details/button-panel/ButtonPanel';
import NotificationsIcon from '../../components/notifications/notifications-icon/NotificationsIcon';
import AccountSelection from '../../components/common/account-selection/AccountSelection';
import AccountMenu from '../../components/account-menu/AccountMenu';
import { Drawer } from 'react-native-drawer-layout';
import QRScannerView from '../../components/common/qr-scanner/QRScannerView';
import PWTouchableOpacity from '../../components/common/touchable-opacity/PWTouchableOpacity';

//TODO support local currencies correctly
//TODO hook up all the button panel buttons correctly
//TODO implement more menu
//TODO figure out and implement banners/spot banners
const AccountScreen = () => {
  const { theme } = useTheme();
  const styles = useStyles();
  const { getSelectedAccount } = useAppStore();
  const account = getSelectedAccount();

  const { totalAlgo, totalLocal, loading } = useAccountBalances(
    account ? [account] : [],
  );
  const [chartData, setChartData] = useState<AccountWealthHistoryItem | null>(
    null,
  );
  const [scrollingEnabled, setScrollingEnabled] = useState<boolean>(true);
  const [scannerVisible, setScannerVisible] = useState<boolean>(false);
  const [drawerOpen, setDrawerOpen] = useState<boolean>(false);

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
        <PWView style={styles.iconBar}>
          <PWView style={styles.iconBarSection}>
            <AccountSelection onPress={toggleAccountSelectorVisible} />
          </PWView>
          <PWView style={styles.iconBarSection}>
            <PWTouchableOpacity onPress={openQRScanner}>
              <CameraIcon style={styles.icon} color={theme.colors.textMain} />
            </PWTouchableOpacity>
            <NotificationsIcon
              style={styles.icon}
              color={theme.colors.textMain}
            />
          </PWView>
        </PWView>
        <ScrollView
          scrollEnabled={scrollingEnabled}
          style={styles.webview}
          contentContainerStyle={styles.webviewContent}
        >
          <PWView style={styles.valueBar}>
            <CurrencyDisplay
              h1
              value={chartData ? Decimal(chartData.algo_value) : totalAlgo}
              currency="ALGO"
              precision={2}
              h1Style={styles.primaryCurrency}
              skeleton={loading}
            />
            <PWView style={styles.secondaryValueBar}>
              <CurrencyDisplay
                h4
                h4Style={styles.valueTitle}
                value={
                  chartData
                    ? Decimal(chartData.value_in_currency ?? '0')
                    : totalLocal
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
            </PWView>
          </PWView>

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
        <PWTouchableOpacity
          onPress={closeQRScanner}
          style={styles.scannerClose}
        >
          <CrossIcon color={theme.colors.textWhite} />
        </PWTouchableOpacity>
      </QRScannerView>
    </Drawer>
  );
};

export default AccountScreen;
