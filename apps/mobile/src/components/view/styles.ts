import { makeStyles } from '@rneui/themed';
import { PeraViewProps } from './PeraView';

export const useStyles = makeStyles((theme, props: PeraViewProps) => ({
  defaultStyle: {
    backgroundColor: theme.colors.background
  },
}));
