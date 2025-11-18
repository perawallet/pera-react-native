import { Text } from '@rneui/themed';
import PWView from '../view/PWView';
import { useStyles } from './styles';
import {
    formatCurrency,
  useAllAccounts,
  useCurrency,
  useSettings,
  useV2WalletWealthList,
  V1WalletWealthListQueryParamsPeriodEnum,
  WalletAccount
} from '@perawallet/core';
import { useMemo } from 'react';
import PWIcon from '../icons/PWIcon';
import { ChartPeriod } from '../chart-period-selection/ChartPeriodSelection';
import Decimal from 'decimal.js';

type WealthTrendProps = {
  account?: WalletAccount;
  period: ChartPeriod;
};

const WealthTrend = ({ account, period }: WealthTrendProps) => {
  const styles = useStyles();
  const { preferredCurrency } = useCurrency();
  const { privacyMode } = useSettings();

  const accounts = useAllAccounts();
  const addresses = useMemo(
    () =>
      account
        ? [account.address]
        : accounts.map((a: WalletAccount) => a.address),
    [account, accounts]
  );

  const { data, isPending } = useV2WalletWealthList({
    params: {
      account_addresses: addresses,
      period: period as V1WalletWealthListQueryParamsPeriodEnum,
      currency: preferredCurrency
    }
  });

  const dataPoints = useMemo(
    () =>
      data?.results?.map(p => {
        return Number(p.value_in_currency)
      }) ?? [],
    [data]
  );

  const [absolute, percentage, isPositive] = useMemo(() => {
    const firstDp = dataPoints.at(0) ?? 0
    const lastDp = dataPoints.at(-1) ?? 0

    return [Decimal(lastDp - firstDp), 
        lastDp ? (firstDp - lastDp) / lastDp : 0, 
        lastDp >= firstDp
    ]
  }, [dataPoints])

  return (
    isPending || privacyMode ? <></> : <PWView style={styles.container}>
      <Text style={isPositive ? styles.itemUp : styles.itemDown} h4>
        {isPositive ? "+" : "-"}{formatCurrency(absolute, 2, preferredCurrency, undefined, true)}
      </Text>
      <PWView style={styles.percentageContainer}>
        <PWIcon name={isPositive ? "arrow-up" : "arrow-down"} 
            variant={isPositive ? "helper" : "error"} size="sm" 
            style={isPositive ? styles.trendIconUp : styles.trendIconDown} />
        <Text style={isPositive ? styles.itemUp : styles.itemDown} h4>
            {percentage.toFixed(2)}%
        </Text>
      </PWView>
    </PWView>
  );
};

export default WealthTrend;
