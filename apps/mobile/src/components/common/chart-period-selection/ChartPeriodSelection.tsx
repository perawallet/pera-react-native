import { Text } from '@rneui/themed';
import PeraView from '../view/PeraView';
import { useStyles } from './styles';
import { useCallback, useState } from 'react';
import { TouchableOpacity } from 'react-native';

export const ChartPeriods = {
  OneDay: 'one-day',
  OneWeek: 'one-week',
  OneMonth: 'one-month',
  OneYear: 'one-year',
};

export type ChartPeriod = (typeof ChartPeriods)[keyof typeof ChartPeriods];

type ChartPeriodSelectionProps = {
  value: ChartPeriod;
  onChange: (val: ChartPeriod) => void;
};

const ChartPeriodSelection = ({
  value,
  onChange,
}: ChartPeriodSelectionProps) => {
  const styles = useStyles();
  const [activeValue, setActiveValue] = useState<ChartPeriod>(value);

  const handlePressed = useCallback(
    (newValue: ChartPeriod) => {
      if (activeValue !== newValue) {
        setActiveValue(newValue);
        onChange(newValue);
      }
    },
    [onChange, setActiveValue, activeValue],
  );

  return (
    <PeraView style={styles.container}>
      <TouchableOpacity
        onPress={() => handlePressed(ChartPeriods.OneWeek)}
        style={
          activeValue === ChartPeriods.OneWeek
            ? styles.selectedButtonContainer
            : styles.unselectedButtonContainer
        }
      >
        <Text>1W</Text>
      </TouchableOpacity>
      <TouchableOpacity
        onPress={() => handlePressed(ChartPeriods.OneMonth)}
        style={
          activeValue === ChartPeriods.OneMonth
            ? styles.selectedButtonContainer
            : styles.unselectedButtonContainer
        }
      >
        <Text>1M</Text>
      </TouchableOpacity>
      <TouchableOpacity
        onPress={() => handlePressed(ChartPeriods.OneYear)}
        style={
          activeValue === ChartPeriods.OneYear
            ? styles.selectedButtonContainer
            : styles.unselectedButtonContainer
        }
      >
        <Text>1Y</Text>
      </TouchableOpacity>
    </PeraView>
  );
};

export default ChartPeriodSelection;
