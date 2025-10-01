import { useStyles } from './styles';
import { Text, TextProps } from '@rneui/themed';
import PeraView from '../view/PeraView';
import { useMemo } from 'react';
import { formatCurrency, useDeviceInfoService } from '@perawallet/core';
import { Decimal } from 'decimal.js';
import AlgoIcon from '../../../../assets/icons/algo.svg';

export type CurrencyDisplayProps = {
  currency: string;
  value: Decimal;
  precision: number;
  prefix?: string;
  alignRight?: boolean;
  showSymbol?: boolean;
  units?: 'K' | 'M';
} & TextProps;

const CurrencyDisplay = (props: CurrencyDisplayProps) => {
  const themeStyle = useStyles(props);
  const deviceInfo = useDeviceInfoService();
  const {
    currency,
    value,
    precision,
    prefix,
    units,
    showSymbol = true,
    ...rest
  } = props;

  const isAlgo = useMemo(() => currency === 'ALGO', [currency]);

  const displayValue = useMemo(() => {
    return formatCurrency(
      value,
      precision,
      currency,
      deviceInfo.getDeviceLocale(),
      showSymbol,
      units,
    );
  }, [value, precision, currency, deviceInfo, showSymbol, units]);

  return (
    <PeraView style={themeStyle.container}>
      {isAlgo && showSymbol && (
        <AlgoIcon
          style={[
            themeStyle.algoIcon,
            props.style,
            props.h1Style,
            props.h2Style,
            props.h3Style,
            props.h4Style,
          ]}
        />
      )}
      <PeraView style={themeStyle.textContainer}>
        <Text {...rest}>
          {prefix ? prefix : ''}
          {displayValue}
          {units}
        </Text>
      </PeraView>
    </PeraView>
  );
};

export default CurrencyDisplay;
