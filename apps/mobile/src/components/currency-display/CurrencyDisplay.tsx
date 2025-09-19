import { useStyles } from './styles';
import { Text, TextProps } from '@rneui/themed';
import PeraView from '../view/PeraView';
import { useMemo } from 'react';
import { asFixedPrecisionNumber } from '@perawallet/core';

export type CurrencyDisplayProps = {
  currencySymbol?: string;
  currencySymbolIcon?: React.ReactElement<{}>;
  value: string;
  precision: number;
} & TextProps;

const CurrencyDisplay = (props: CurrencyDisplayProps) => {
  const themeStyle = useStyles(props);
  const { currencySymbol, currencySymbolIcon, value, precision, ...rest } =
    props;

  const displayValue = useMemo(() => {
    const formattedValue = asFixedPrecisionNumber(value, precision);
    return `${currencySymbol ?? ''}${formattedValue}`;
  }, [value, precision, currencySymbol]);

  return (
    <PeraView style={themeStyle.container}>
      {currencySymbolIcon}
      <Text {...rest}>{displayValue}</Text>
    </PeraView>
  );
};

export default CurrencyDisplay;
