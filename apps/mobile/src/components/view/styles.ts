import { makeStyles } from '@rneui/themed';
import { PropsWithChildren } from 'react';

export const useStyles = makeStyles((theme, props: PropsWithChildren) => ({
  defaultStyle: {
    backgroundColor: theme.colors.background
  },
}));
