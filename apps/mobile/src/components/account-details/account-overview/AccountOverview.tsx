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

import PWView from '../../common/view/PWView';
import {
  AccountWealthHistoryItem,
  formatDatetime,
  useAccountBalances,
  useCurrency,
  useSettings,
  WalletAccount
} from '@perawallet/core';
import { ScrollView } from 'react-native';
import CurrencyDisplay from '../../common/currency-display/CurrencyDisplay';
import Decimal from 'decimal.js';
import WealthChart from '../../common/wealth-chart/WealthChart';
import ButtonPanel from '../button-panel/ButtonPanel';
import AccountAssetList from '../asset-list/AccountAssetList';
import { Text } from '@rneui/themed';
import { useCallback, useState } from 'react';
import { useStyles } from './styles';
import PWTouchableOpacity from '../../common/touchable-opacity/PWTouchableOpacity';
import WealthTrend from '../../common/wealth-trend/WealthTrend';
import ChartPeriodSelection, { ChartPeriod } from '../../common/chart-period-selection/ChartPeriodSelection';

type AccountOverviewProps = {
  account: WalletAccount;
};

//TODO implement min balance display and info icon
//TODO layout and spacing needs a bit of clean up
const AccountOverview = ({ account }: AccountOverviewProps) => {
  const { preferredCurrency } = useCurrency();
  const styles = useStyles();

  const { totalAlgo, totalLocal, loading } = useAccountBalances(
    account ? [account] : []
  );

  const [period, setPeriod] = useState<ChartPeriod>('one-week');
  const [chartData, setChartData] = useState<AccountWealthHistoryItem | null>(
    null
  );
  const [scrollingEnabled, setScrollingEnabled] = useState<boolean>(true);
  const { privacyMode, setPrivacyMode } = useSettings();

  const togglePrivacyMode = () => {
    setPrivacyMode(!privacyMode);
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
    [setChartData]
  );

  return (
    <>
      <ScrollView
        scrollEnabled={scrollingEnabled}
        style={styles.scrollView}
        contentContainerStyle={styles.scrollViewContent}
      >
        <PWTouchableOpacity onPress={togglePrivacyMode} style={styles.valueBar}>
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
              currency={preferredCurrency}
              prefix="≈ "
              precision={2}
              skeleton={loading}
            />
            {!chartData && (
                <WealthTrend account={account} period={period} />
            )}
            {chartData && (
              <Text h4 h4Style={styles.dateDisplay}>
                {formatDatetime(chartData.datetime)}
              </Text>
            )}
          </PWView>
        </PWTouchableOpacity>

        {!!account && (
            <>
          <WealthChart
            account={account}
            period={period}
            onSelectionChanged={chartSelectionChanged}
          />
         <ChartPeriodSelection value={period} onChange={setPeriod} />
         </>
        )}

        <ButtonPanel />

        {!!account && <AccountAssetList account={account} />}
      </ScrollView>
    </>
  );
};

export default AccountOverview;
