import { PropsWithChildren } from 'react';
import { useStyles } from './styles';
import { View } from 'react-native';

const PeraView = (props: PropsWithChildren) => {
  const style = useStyles(props);

  return <View style={style.defaultStyle} {...props}>{props.children}</View>;
};

export default PeraView;
