import { useStyles } from './styles';
import PeraView from '../../common/view/PeraView';
import { ViewStyle } from 'react-native';
import { Text } from '@rneui/themed';
import AssetIcon from '../../common/asset-icon/AssetIcon';

type SwapPairItemProps = {
  fromName: string;
  toName: string;
  style: ViewStyle;
};

const SwapPair = (props: SwapPairItemProps) => {
  const themeStyle = useStyles();

  return (
    <PeraView style={props.style}>
      <PeraView style={themeStyle.itemIconContainer}>
        <AssetIcon asset={props.fromName} style={themeStyle.fromIcon}/>
        <AssetIcon asset={props.toName} style={themeStyle.toIcon} />
      </PeraView>
      <Text h4>
        {props.fromName} to {props.toName}
      </Text>
    </PeraView>
  );
};
export default SwapPair;
