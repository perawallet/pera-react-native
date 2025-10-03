import { useMemo } from 'react';
import {
  MaskedTextInput,
  MaskedTextInputProps,
} from 'react-native-advanced-input-mask';

type CurrencyInputProps = {
  minPrecision: number;
  maxPrecision: number;
} & Omit<MaskedTextInputProps, 'mask' | 'autocomplete' | 'allowedKeys'>;

const CurrencyInput = (props: CurrencyInputProps) => {
  const { minPrecision, maxPrecision, ...rest } = props;

  //TODO: the mask doesn't appear to work correctly
  const inputMask = useMemo(() => {
    const mask =
      '[0' +
      '9'.repeat(12) +
      '].[' +
      '9'.repeat(maxPrecision - minPrecision) +
      '0'.repeat(minPrecision) +
      ']';
    return mask;
  }, [minPrecision, maxPrecision]);

  return (
    <MaskedTextInput
      {...rest}
      allowedKeys="0123456789,."
      inputMode="numeric"
      autocomplete={false}
      mask={inputMask}
    />
  );
};

export default CurrencyInput;
