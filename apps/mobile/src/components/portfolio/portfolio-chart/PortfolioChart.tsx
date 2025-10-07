import { useStyles } from './styles';
import { LineChart } from 'react-native-gifted-charts';

import PeraView from '../../common/view/PeraView';
import {
  AccountWealthHistoryItem,
  useAllAccounts,
  useV2WalletWealthList,
  V1WalletWealthListQueryParamsPeriodEnum,
  WalletAccount,
} from '@perawallet/core';
import { useCallback, useMemo, useState } from 'react';
import ChartPeriodSelection, {
  ChartPeriod,
} from '../../common/chart-period-selection/ChartPeriodSelection';
import { useTheme } from '@rneui/themed';

const SHOW_ALGO_AMOUNTS = true; //TODO remove this - it's only for debugging when no USD values are present
const FOCUS_DEBOUNCE_TIME = 200;

type PortfolioChartProps = {
  onSelectionChanged: (item: AccountWealthHistoryItem | null) => void;
};

const PortfolioChart = ({ onSelectionChanged }: PortfolioChartProps) => {
  const { theme } = useTheme();
  const themeStyle = useStyles();
  const accounts = useAllAccounts();
  const [lastSentIndex, setLastSentIndex] = useState<number>();
  const [lastSentTime, setLastSentTime] = useState<number>(Date.now());

  const addresses = useMemo(
    () => accounts.map((a: WalletAccount) => a.address),
    [accounts],
  );
  const [period, setPeriod] = useState<ChartPeriod>('one-week');

  const { data, isPending } = useV2WalletWealthList({
    params: {
      account_addresses: addresses,
      period: period as V1WalletWealthListQueryParamsPeriodEnum,
      currency: 'USD', //TODO: pull this from settings later
    },
  });

  const dataPoints = useMemo(
    () =>
      data?.results?.map(p => {
        return {
          value: SHOW_ALGO_AMOUNTS
            ? Number(p.algo_value)
            : Number(p.value_in_currency),
        };
      }) ?? [],
    [data],
  );

  const yAxisOffsets = useMemo(() => {
    const minValue = Math.min(...dataPoints.map(p => p.value));
    const maxValue = Math.max(...dataPoints.map(p => p.value));
    if (minValue === 0 && maxValue === 0) {
      return [-1, 1];
    } else {
      return [minValue - minValue / 10, maxValue + maxValue / 10];
    }
  }, [dataPoints]);

  const onFocus = useCallback(
    ({ pointerIndex: index, pointerX }: { pointerIndex: number, pointerX: number }) => {
      if (Date.now() - lastSentTime > FOCUS_DEBOUNCE_TIME) {
        if (pointerX > 0 && index >= 0 && index !== lastSentIndex) {
          const dataItem = data?.results?.[index] ?? null;
          onSelectionChanged(dataItem);
          setLastSentIndex(index)
        } else if (pointerX === 0) {
          onSelectionChanged(null)
          setLastSentIndex(undefined)
        }
        setLastSentTime(Date.now())
      }
    },
    [data, onSelectionChanged, lastSentIndex, setLastSentIndex],
  );

  if (!isPending && !dataPoints?.length) {
    return <></>;
  }

  return (
    <PeraView style={themeStyle.container}>
      <LineChart
        data={dataPoints}
        hideAxesAndRules
        height={140}
        color={theme.colors.helperPositive}
        startFillColor="#28A79B"
        endFillColor="#28A79B"
        startOpacity={0.3}
        endOpacity={0.0}
        areaChart
        yAxisLabelWidth={30}
        hideYAxisText
        yAxisOffset={yAxisOffsets[0]}
        maxValue={yAxisOffsets[1]}
        initialSpacing={0}
        endSpacing={0}
        showStripOnFocus
        showDataPointOnFocus
        pointerConfig={
          {
            showPointerStrip: true,
            pointerStripColor: theme.colors.textGrayLighter,
            pointerStripWidth: 1,
            pointerStripHeight: 140,
            pointerColor: theme.colors.helperPositive,
            strokeDashArray: [6, 2]
          }
        }
        getPointerProps={onFocus}
        disableScroll
        adjustToWidth
      />
      <ChartPeriodSelection value={period} onChange={setPeriod} />
    </PeraView>
  );
};

export default PortfolioChart;
