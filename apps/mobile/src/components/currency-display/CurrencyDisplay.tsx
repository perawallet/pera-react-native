import { useStyles } from './styles';
import { Text, TextProps } from '@rneui/themed';
import PeraView from '../view/PeraView';
import { useMemo } from 'react';
import { formatCurrency, useDeviceInfoService } from '@perawallet/core';
import { Decimal } from 'decimal.js';

export type CurrencyDisplayProps = {
  currency: string;
  value: Decimal;
  precision: number;
  prefix?: string;
} & TextProps;

const CurrencyDisplay = (props: CurrencyDisplayProps) => {
  const themeStyle = useStyles(props);
  const deviceInfo = useDeviceInfoService();
  const { currency, value, precision, prefix, ...rest } = props;

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
      <Text {...rest}>
        {prefix ? prefix : ''}
        {displayValue}
      </Text>
    </PeraView>
  );
};

export default CurrencyDisplay;
