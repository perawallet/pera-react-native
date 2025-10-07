import PeraView from '../../components/common/view/PeraView';
import MainScreenLayout from '../../layouts/MainScreenLayout';
import { Text, useTheme } from '@rneui/themed';
import { useStyles } from './styles';
import { ScrollView, TouchableOpacity } from 'react-native';

import CameraIcon from '../../../assets/icons/camera.svg';
import BellIcon from '../../../assets/icons/bell.svg';
import InfoIcon from '../../../assets/icons/info.svg';

import CurrencyDisplay from '../../components/common/currency-display/CurrencyDisplay';
import ButtonPanel from '../../components/portfolio/button-panel/ButtonPanel';
import AccountList from '../../components/portfolio/account-list/AccountList';
import PortfolioChart from '../../components/portfolio/portfolio-chart/PortfolioChart';
import Decimal from 'decimal.js';
import {
  AccountWealthHistoryItem,
  formatDatetime,
  useAccountBalances,
  useAppStore,
} from '@perawallet/core';
import { useCallback, useState } from 'react';

const PortfolioScreen = () => {
  const { theme } = useTheme();
  const styles = useStyles();

  const accounts = useAppStore(state => state.accounts);
  const data = useAccountBalances(accounts);
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

  const chartSelectionChanged = useCallback(
    (selected: AccountWealthHistoryItem | null) => {
      setChartData(selected);

      if (selected) {
        setScrollingEnabled(false)
      } else {
        setScrollingEnabled(true)
      }
    },
    [setChartData],
  );

  return (
    <MainScreenLayout fullScreen>
      <ScrollView
        scrollEnabled={scrollingEnabled}
        style={styles.webview}
        contentContainerStyle={styles.webviewContent}
      >
        <PeraView style={styles.iconBar}>
          <TouchableOpacity>
            <CameraIcon style={styles.icon} color={theme.colors.textMain} />
          </TouchableOpacity>
          <TouchableOpacity>
            <BellIcon style={styles.icon} color={theme.colors.textMain} />
          </TouchableOpacity>
        </PeraView>
        <PeraView style={styles.valueTitleBar}>
          <Text h4Style={styles.valueTitle} h4>
            Portfolio Value
          </Text>
          <TouchableOpacity>
            <InfoIcon style={styles.icon} color={theme.colors.textGray} />
          </TouchableOpacity>
        </PeraView>
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

        <PortfolioChart onSelectionChanged={chartSelectionChanged} />

        <ButtonPanel />

        {/* TODO: Render banners and spot banners here... */}

        <AccountList />
      </ScrollView>
    </MainScreenLayout>
  );
};

export default PortfolioScreen;
