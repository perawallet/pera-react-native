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
