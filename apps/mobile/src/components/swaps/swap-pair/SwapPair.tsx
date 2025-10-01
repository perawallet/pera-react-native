import { useStyles } from './styles';
import PeraView from '../../common/view/PeraView';
import { ViewStyle } from 'react-native';
import { Text } from '@rneui/themed';

type SwapPairItemProps = {
  fromName: string;
  fromIcon: React.ReactElement<{}>;
  toName: string;
  toIcon: React.ReactElement<{}>;
  style: ViewStyle;
};

const SwapPair = (props: SwapPairItemProps) => {
  const themeStyle = useStyles();

  return (
    <PeraView style={props.style}>
      <PeraView style={themeStyle.itemIconContainer}>
        {props.fromIcon}
        {props.toIcon}
      </PeraView>
      <Text h4>
        {props.fromName} to {props.toName}
      </Text>
    </PeraView>
  );
};
export default SwapPair;
