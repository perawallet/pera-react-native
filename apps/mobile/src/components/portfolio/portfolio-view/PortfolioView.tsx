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
import { useStyles } from './styles';

import InfoIcon from '../../../../assets/icons/info.svg';

import PWView from '../../common/view/PWView';
import CurrencyDisplay from '../../common/currency-display/CurrencyDisplay';
import WealthChart from '../../common/wealth-chart/WealthChart';
import { PWViewProps } from '../../common/view/PWView';
import PWTouchableOpacity from '../../common/touchable-opacity/PWTouchableOpacity';
import Decimal from 'decimal.js';
import {
  AccountWealthHistoryItem,
  formatDatetime,
  useAccountBalances,
  useAllAccounts,
  useCurrency,
} from '@perawallet/core';
import { useCallback, useState } from 'react';

type PortfolioViewProps = {
  onDataSelected?: (selected: AccountWealthHistoryItem | null) => void;
} & PWViewProps;

const PortfolioView = (props: PortfolioViewProps) => {
  const { theme } = useTheme();
  const styles = useStyles();
  const { preferredCurrency } = useCurrency()

  const accounts = useAllAccounts();
  const { loading, totalAlgo, totalLocal } = useAccountBalances(accounts);
  const [chartData, setChartData] = useState<AccountWealthHistoryItem | null>(
    null,
  );
  const [chartVisible, setChartVisible] = useState<boolean>(false);

  const toggleChartVisible = () => {
    setChartVisible(!chartVisible);
  };

  const chartSelectionChanged = useCallback(
    (selected: AccountWealthHistoryItem | null) => {
      setChartData(selected);
      props.onDataSelected?.(selected);
    },
    [setChartData, props],
  );

  return (
    <PWView {...props}>
      <PWView style={styles.valueTitleBar}>
        <Text h4Style={styles.valueTitle} h4>
          Portfolio Value
        </Text>
        <PWTouchableOpacity>
          <InfoIcon style={styles.icon} color={theme.colors.textGray} />
        </PWTouchableOpacity>
      </PWView>
      <PWView style={styles.valueBar}>
        <PWView style={styles.valueBarCurrencies}>
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
          </PWView>
          {chartData && (
            <Text h4 h4Style={styles.dateDisplay}>
              {formatDatetime(chartData.datetime)}
            </Text>
          )}
        </PWView>
        <PWTouchableOpacity
          style={styles.chartButton}
          onPress={toggleChartVisible}
        >
          <Text style={styles.chartButtonText}>
            {chartVisible ? 'Hide Chart' : 'Show Chart'}
          </Text>
        </PWTouchableOpacity>
      </PWView>

      {chartVisible && (
        <WealthChart onSelectionChanged={chartSelectionChanged} />
      )}
    </PWView>
  );
};

export default PortfolioView;
