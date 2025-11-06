import { useStyles } from "./styles";
import {  useTheme } from "@rneui/themed";

import EmptyView from "../common/empty-view/EmptyView";

type InboxTabProps = {
}
const InboxTab = (props: InboxTabProps) => {
  const styles = useStyles();
  const { theme } = useTheme();
  
  //TODO implement me

  return (   
    <EmptyView title="No Inbox Items" body="There are currently no pending inbox items" />
  )  
}
export default InboxTab
