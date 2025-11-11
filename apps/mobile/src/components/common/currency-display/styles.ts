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

import { makeStyles } from '@rneui/themed';
import { CurrencyDisplayProps } from './CurrencyDisplay';

export const useStyles = makeStyles((theme, props: CurrencyDisplayProps) => {
  let size = 16;

  if (props.h1) {
    size = 40;
  } else if (props.h2) {
    size = 36;
  } else if (props.h3) {
    size = 24;
  }

  return {
    container: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-start',
      flexShrink: 1,
    },
    skeleton: {
      maxWidth: 150,
      height: size,
    },
    textContainer: {
      flexGrow: 1,
      alignItems: props.alignRight ? 'flex-end' : 'flex-start',
    },
    algoIcon: {
      width: size,
      height: size,
      flexShrink: 1,
    },
  };
});
