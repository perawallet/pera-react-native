import { Text, useTheme } from '@rneui/themed';
import MainScreenLayout from '../../layouts/MainScreenLayout';
import {
  DrawerActions,
  StaticScreenProps,
  useNavigation,
} from '@react-navigation/native';
import {
  AccountWealthHistoryItem,
  formatDatetime,
  getAccountDisplayName,
  useAccountBalances,
  useAllAccounts,
  useAppStore,
  WalletAccount,
} from '@perawallet/core';
import { TouchableOpacity } from 'react-native';

import CameraIcon from '../../../assets/icons/camera.svg';
import WalletIcon from '../../../assets/icons/wallet.svg';
import ChevronDown from '../../../assets/icons/chevron-down.svg';
import InboxIcon from '../../../assets/icons/envelope-letter.svg';

import { useStyles } from './styles';
import { useCallback, useState } from 'react';
import Decimal from 'decimal.js';
import { ScrollView } from 'react-native-gesture-handler';

import CurrencyDisplay from '../../components/common/currency-display/CurrencyDisplay';
import PeraView from '../../components/common/view/PeraView';
import WealthChart from '../../components/common/wealth-chart/WealthChart';
import ButtonPanel from '../../components/account-details/button-panel/ButtonPanel';
import NotificationsIcon from '../../components/common/notifications-icon/NotificationsIcon';

type AccountScreenProps = StaticScreenProps<{
  account?: WalletAccount;
}>;
const AccountScreen = ({ route }: AccountScreenProps) => {
  const { theme } = useTheme();
  const styles = useStyles();
  const navigation = useNavigation();
  const accounts = useAllAccounts();
  const { getSelectedAccount } = useAppStore();
  const account = (route.params?.account ??
    getSelectedAccount() ??
    accounts.at(0))!;

  const data = useAccountBalances(account ? [account] : []);
  const [chartData, setChartData] = useState<AccountWealthHistoryItem | null>(
    null,
  );
  const [scrollingEnabled, setScrollingEnabled] = useState<boolean>(true);

  const loading = data.some(d => !d.isFetched);
  const algoAmount = data.reduce(
    (acc, cur) => acc.plus(cur.algoAmount),
    Decimal(0),
  );
  const usdAmount = data.reduce(
    (acc, cur) => acc.plus(cur.usdAmount),
    Decimal(0),
  );

  const toggleAccountSelectorVisible = () => {
    navigation.dispatch(DrawerActions.toggleDrawer());
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
    <MainScreenLayout fullScreen>
      <PeraView style={styles.iconBar}>
        <PeraView style={styles.iconBarSection}>
          <TouchableOpacity
            style={styles.accountSelection}
            onPress={toggleAccountSelectorVisible}
          >
            <WalletIcon style={styles.icon} color={theme.colors.textMain} />
            <Text h4Style={styles.valueTitle} h4>
              {getAccountDisplayName(account)}
            </Text>
            <ChevronDown />
          </TouchableOpacity>
        </PeraView>
        <PeraView style={styles.iconBarSection}>
          <TouchableOpacity>
            <InboxIcon style={styles.icon} color={theme.colors.textMain} />
          </TouchableOpacity>
          <TouchableOpacity>
            <CameraIcon style={styles.icon} color={theme.colors.textMain} />
          </TouchableOpacity>
          <NotificationsIcon style={styles.icon} color={theme.colors.textMain} />
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

        <WealthChart
          account={account}
          onSelectionChanged={chartSelectionChanged}
        />

        <ButtonPanel />

        {/* TODO: Render asset list here... */}
      </ScrollView>
    </MainScreenLayout>
  );
};

export default AccountScreen;
