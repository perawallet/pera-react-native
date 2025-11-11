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

import { useStyles } from './styles';
import PeraView from '../../common/view/PeraView';
import { ViewStyle } from 'react-native';
import { Text } from '@rneui/themed';
import AssetIcon from '../../common/asset-icon/AssetIcon';
import { AssetDetailSerializerResponse } from '@perawallet/core';

type SwapPairItemProps = {
  fromAsset: AssetDetailSerializerResponse;
  toAsset: AssetDetailSerializerResponse;
  style: ViewStyle;
};

const SwapPair = (props: SwapPairItemProps) => {
  const themeStyle = useStyles();

  return (
    <PeraView style={props.style}>
      <PeraView style={themeStyle.itemIconContainer}>
        <AssetIcon asset={props.fromAsset} style={themeStyle.fromIcon} />
        <AssetIcon asset={props.toAsset} style={themeStyle.toIcon} />
      </PeraView>
      <Text h4>
        {props.fromAsset?.unit_name} to {props.toAsset?.unit_name}
      </Text>
    </PeraView>
  );
};
export default SwapPair;
