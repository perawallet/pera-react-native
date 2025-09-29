import { useStyles } from './styles';
import { Text, TextProps } from '@rneui/themed';
import PeraView from '../view/PeraView';
import { useMemo } from 'react';
import { formatCurrency, useDeviceInfoService } from '@perawallet/core';
import { Decimal } from 'decimal.js';
import AlgoIcon from '../../../assets/icons/algo.svg'

export type CurrencyDisplayProps = {
  currency: string;
  value: Decimal;
  precision: number;
  prefix?: string;
  alignRight?: boolean;
} & TextProps;

const CurrencyDisplay = (props: CurrencyDisplayProps) => {
  const themeStyle = useStyles(props);
  const deviceInfo = useDeviceInfoService();
  const { currency, value, precision, prefix, alignRight = false, ...rest } = props;

  const isAlgo = useMemo(() => currency === 'ALGO', [currency])

  const displayValue = useMemo(() => {
    return formatCurrency(
      value,
      precision,
      currency,
      deviceInfo.getDeviceLocale(),
    );
  }, [value, precision, currency, deviceInfo]);

  return (
    <PeraView style={themeStyle.container}>
      {isAlgo && <AlgoIcon style={themeStyle.algoIcon} />}
      <PeraView style={themeStyle.textContainer}>
        <Text {...rest}>
          {prefix ? prefix : ''}
          {displayValue}
        </Text>
      </PeraView>
    </PeraView>
  );
};

export default CurrencyDisplay;
