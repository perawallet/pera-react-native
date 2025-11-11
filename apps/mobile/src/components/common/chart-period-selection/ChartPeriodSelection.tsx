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
