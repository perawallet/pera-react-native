import { Text } from '@rneui/themed';
import PeraView, { PeraViewProps } from '../view/PeraView';
import { useStyles } from './styles';

export type EmptyViewProps = {
  title?: string;
  body: string;
  icon?: React.ReactElement<{}>;
  button?: React.ReactElement<{}>;
} & PeraViewProps;

const EmptyView = (props: EmptyViewProps) => {
  const styles = useStyles();
  const { title, body, icon, style, button, ...rest } = props;

  return (
    <PeraView {...rest} style={[styles.container, style]}>
      {icon}
      {!!title && (
        <Text h3 h3Style={styles.text}>
          {title}
        </Text>
      )}
      <Text style={styles.text}>{body}</Text>
      {button}
    </PeraView>
  );
};

export default EmptyView;
