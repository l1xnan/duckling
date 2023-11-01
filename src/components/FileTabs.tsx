import { Box, Tab, TabProps, styled } from "@mui/material";
import { TabList, TabPanelProps, useTabContext } from "@mui/lab";
import { FunctionComponent, PropsWithChildren } from "react";

export const FileTabList = styled(TabList)({
  borderBottom: "1px solid #e8e8e8",
  maxHeight: "32px",
  minHeight: "32px",
  backgroundColor: "white",
  "& .MuiTabs-indicator": {
    backgroundColor: "#1890ff",
  },
});

export const FileTab = styled((props: TabProps) => (
  <Tab disableRipple {...props} />
))(({ theme }) => ({
  minHeight: "32px",
  maxHeight: "32px",
  textTransform: "none",
  minWidth: 0,
  [theme.breakpoints.up("sm")]: {
    minWidth: 0,
  },
  fontWeight: theme.typography.fontWeightRegular,
  marginRight: theme.spacing(1),
  color: "rgba(0, 0, 0, 0.85)",
  "&:hover": {
    color: "#40a9ff",
    opacity: 1,
  },
  "&.Mui-selected": {
    color: "#1890ff",
    fontWeight: theme.typography.fontWeightMedium,
  },
  "&.Mui-focusVisible": {
    backgroundColor: "#d1eaff",
  },
}));

export const FileTabPanel: FunctionComponent<PropsWithChildren<TabPanelProps>> = ({
  children,
  value,
}) => {
  const { value: contextValue } = useTabContext() || {};
  return (
    <Box
      sx={{ display: value === contextValue ? "block" : "none" }}
      key={value}
    >
      {children}
    </Box>
  );
};
