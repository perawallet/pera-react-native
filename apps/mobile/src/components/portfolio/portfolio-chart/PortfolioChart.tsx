import { useStyles } from './styles';
import { LineChart } from "react-native-gifted-charts";

import PeraView from '../../common/view/PeraView';
import { AccountWealthHistoryItem, useAllAccounts, useV2WalletWealthList, V1WalletWealthListQueryParamsPeriodEnum } from '@perawallet/core';
import { useCallback, useMemo, useState } from 'react';
import ChartPeriodSelection, { ChartPeriod } from '../../common/chart-period-selection/ChartPeriodSelection';
import { useTheme } from '@rneui/themed';

const UNFOCUS_TIMEOUT = 1000
const SHOW_ALGO_AMOUNTS = true //TODO remove this - it's only for debugging when no USD values are present

type PortfolioChartProps = {
  onSelectionChanged: (item: AccountWealthHistoryItem | null) => void
};

const PortfolioChart = ({ onSelectionChanged }: PortfolioChartProps) => {
  const { theme } = useTheme()
  const themeStyle = useStyles();
  const accounts = useAllAccounts();
  const [unfocusTimer, setUnfocusTimer] = useState<NodeJS.Timeout>()

  const addresses = useMemo(() => accounts.map(a => a.address), [accounts])
  const [period, setPeriod] = useState<ChartPeriod>('one-week')

  const { data, isPending } = useV2WalletWealthList({
    params: {
      account_addresses: addresses,
      period: period as V1WalletWealthListQueryParamsPeriodEnum,
      currency: 'USD' //TODO: pull this from settings later
    }
  })

  const dataPoints = useMemo(() => 
    data?.results?.map((p) => {
      return {
        value: SHOW_ALGO_AMOUNTS ? Number(p.algo_value) : Number(p.value_in_currency)
      }
    }) ?? [], 
  [data])

  const yAxisOffsets = useMemo(() => {
    const minValue = Math.min(...dataPoints.map(p => p.value))
    const maxValue = Math.max(...dataPoints.map(p => p.value))
    if (minValue === 0 && maxValue === 0) {
      return [-1, 1]
    } else {
      return [minValue - (minValue / 10), maxValue + (maxValue / 10)]
    }
  }, [dataPoints])

  const onFocus = useCallback((_: any, index: number) => {
    const dataItem = data?.results?.[index] ?? null
    onSelectionChanged(dataItem)
    if (unfocusTimer) {
      clearTimeout(unfocusTimer)
    }
    setUnfocusTimer(setTimeout(() => onSelectionChanged(null), UNFOCUS_TIMEOUT))
  }, [data])

  if (!isPending && !dataPoints?.length) {
    return <></>
  }
  
  return (
    <PeraView style={themeStyle.container}>
      <LineChart data={dataPoints} 
        hideAxesAndRules
        height={140}
        color={theme.colors.helperPositive}
        startFillColor="#28A79B"
        endFillColor="#28A79B"
        startOpacity={0.3}
        endOpacity={0.0}
        areaChart
        yAxisLabelWidth={0}
        hideYAxisText
        yAxisOffset={yAxisOffsets[0]}
        maxValue={yAxisOffsets[1]}
        initialSpacing={0}
        endSpacing={0}
        focusEnabled
        showStripOnFocus
        showDataPointOnFocus
        stripColor={theme.colors.textGrayLighter}
        stripWidth={1}
        stripHeight={140}
        stripOpacity={1}
        stripStrokeDashArray={[6,2]}
        focusedDataPointColor={theme.colors.helperPositive}
        focusedDataPointWidth={theme.spacing.md}
        focusedDataPointHeight={theme.spacing.md}
        delayBeforeUnFocus={UNFOCUS_TIMEOUT}
        disableScroll
        onFocus={onFocus}
        adjustToWidth
        />
      <ChartPeriodSelection value={period} onChange={setPeriod} />
    </PeraView>
  );
};

export default PortfolioChart;
