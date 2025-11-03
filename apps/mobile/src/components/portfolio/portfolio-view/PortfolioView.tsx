import PeraView from '../../../components/common/view/PeraView';
import { Text, useTheme } from '@rneui/themed';
import { useStyles } from './styles';
import { TouchableOpacity } from 'react-native';

import InfoIcon from '../../../../assets/icons/info.svg';

import CurrencyDisplay from '../../../components/common/currency-display/CurrencyDisplay';
import WealthChart from '../../../components/common/wealth-chart/WealthChart';
import Decimal from 'decimal.js';
import {
  AccountWealthHistoryItem,
  formatDatetime,
  useAccountBalances,
  useAppStore,
} from '@perawallet/core';
import { useCallback, useState } from 'react';
import { PeraViewProps } from '@components/common/view/PeraView';

type PortfolioViewProps = {
    onDataSelected?: (selected: AccountWealthHistoryItem | null) => void
} & PeraViewProps

const PortfolioView = (props: PortfolioViewProps) => {
  const { theme } = useTheme();
  const styles = useStyles();

  const accounts = useAppStore(state => state.accounts);
  const data = useAccountBalances(accounts);
  const [chartData, setChartData] = useState<AccountWealthHistoryItem | null>(
    null,
  );
  const [chartVisible, setChartVisible] = useState<boolean>(false);

  const loading = data.some(d => !d.isFetched);
  const algoAmount = data.reduce(
    (acc, cur) => acc.plus(cur.algoAmount),
    Decimal(0),
  );
  const usdAmount = data.reduce(
    (acc, cur) => acc.plus(cur.usdAmount),
    Decimal(0),
  );

  const toggleChartVisible = () => {
    setChartVisible(!chartVisible)
  }

  const chartSelectionChanged = useCallback(
    (selected: AccountWealthHistoryItem | null) => {
      setChartData(selected);
      props.onDataSelected?.(selected)
    },
    [setChartData, props],
  );

  return (
    <PeraView {...props}>
        <PeraView style={styles.valueTitleBar}>
          <Text h4Style={styles.valueTitle} h4>
            Portfolio Value
          </Text>
          <TouchableOpacity>
            <InfoIcon style={styles.icon} color={theme.colors.textGray} />
          </TouchableOpacity>
        </PeraView>
        <PeraView style={styles.valueBar}>
          <PeraView style={styles.valueBarCurrencies}>
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
            </PeraView>
            {chartData && (
                <Text h4 h4Style={styles.dateDisplay}>
                    {formatDatetime(chartData.datetime)}
                </Text>
            )}
          </PeraView>
            <TouchableOpacity style={styles.chartButton} onPress={toggleChartVisible}>
                <Text style={styles.chartButtonText} >{chartVisible ? 'Hide Chart' : 'Show Chart'}</Text>
            </TouchableOpacity>
        </PeraView>

        {chartVisible && <WealthChart onSelectionChanged={chartSelectionChanged} />}
    </PeraView>
  );
};

export default PortfolioView;
