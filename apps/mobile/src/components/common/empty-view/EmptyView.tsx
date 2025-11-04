import { Text } from '@rneui/themed';
import PeraView, { PeraViewProps } from '../view/PeraView';
import { useStyles } from './styles';

export type EmptyViewProps = {
  title?: string,
  body: string,
  icon?: React.ReactElement<{}>;
} & PeraViewProps;

const EmptyView = (props: EmptyViewProps) => {
  const styles = useStyles()
  const { title, body, icon, style, ...rest } = props

  return <PeraView {...rest} style={styles.container}>
    {icon}
    {title && <Text h3 h3Style={styles.text}>{title}</Text>}
    <Text style={styles.text}>{body}</Text>
  </PeraView>
};

export default EmptyView;
