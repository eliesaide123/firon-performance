/**
 * FP_ component barrel (CONTRACT §12).
 *
 * Screens import from here and compose FP_* components only — no raw <button>,
 * <input> or styled <div class="card"> in a page.
 */

/* layout primitives */
export { default as FP_Row } from './FP_Row';
export { default as FP_Column } from './FP_Column';
export { default as FP_Screen } from './FP_Screen';
export { default as FP_Divider } from './FP_Divider';
export { default as FP_Pressable } from './FP_Pressable';

/* text + identity */
export { default as FP_Label } from './FP_Label';
export { default as FP_Icon } from './FP_Icon';
export { default as FP_Avatar } from './FP_Avatar';
export { default as FP_Badge, FP_StatusBadge } from './FP_Badge';
export { default as FP_Breadcrumbs } from './FP_Breadcrumbs';
export { default as FP_Tooltip } from './FP_Tooltip';

/* surfaces */
export { default as FP_Card, FP_CardHead } from './FP_Card';
export { default as FP_StatCard } from './FP_StatCard';
export { default as FP_KeyValueRow } from './FP_KeyValueRow';
export { default as FP_ListItem } from './FP_ListItem';
export { default as FP_Thumb } from './FP_Thumb';

/* controls */
export { default as FP_Button } from './FP_Button';
export { default as FP_IconButton } from './FP_IconButton';
export { default as FP_Fab } from './FP_Fab';
export { default as FP_Textbox } from './FP_Textbox';
export { default as FP_Textarea } from './FP_Textarea';
export { default as FP_Select } from './FP_Select';
export { default as FP_Switch } from './FP_Switch';
export { default as FP_Checkbox } from './FP_Checkbox';
export { default as FP_Chip } from './FP_Chip';
export { default as FP_ChipScroll } from './FP_ChipScroll';
export { default as FP_Segmented } from './FP_Segmented';
export { default as FP_Tabs } from './FP_Tabs';
export { default as FP_SearchInput } from './FP_SearchInput';
export { default as FP_OtpInput } from './FP_OtpInput';
export { default as FP_TimePicker } from './FP_TimePicker';
export { default as FP_ColorPicker } from './FP_ColorPicker';
export { default as FP_JsonEditor } from './FP_JsonEditor';

/* feedback */
export { default as FP_Spinner } from './FP_Spinner';
export { default as FP_LoadingBlock } from './FP_LoadingBlock';
export { default as FP_Skeleton } from './FP_Skeleton';
export { default as FP_SkeletonRows } from './FP_SkeletonRows';
export { default as FP_SkeletonCards } from './FP_SkeletonCards';
export { default as FP_ProgressBar } from './FP_ProgressBar';
export { default as FP_ProgressRing } from './FP_ProgressRing';
export { default as FP_EmptyState } from './FP_EmptyState';
export { default as FP_ErrorState } from './FP_ErrorState';
export { default as FP_ErrorBoundary } from './FP_ErrorBoundary';
export { default as FP_StatusDot } from './FP_StatusDot';

/* overlays */
export { default as FP_Modal } from './FP_Modal';
export { default as FP_BottomSheet } from './FP_BottomSheet';
export { default as FP_Drawer } from './FP_Drawer';
export { default as FP_Alert } from './FP_Alert';
export { default as FP_AlertProvider } from './FP_AlertProvider';
export { default as FP_ConfirmDialog, fpConfirm } from './FP_ConfirmDialog';
export { default as FP_Toast } from './FP_Toast';
export { default as FP_ToastProvider, useToast } from './FP_ToastProvider';

/* CMS-only */
export { default as FP_Table } from './FP_Table';
export { default as FP_Pagination } from './FP_Pagination';
export { default as FP_FileDrop } from './FP_FileDrop';
export { default as FP_MediaThumb } from './FP_MediaThumb';
export { default as FP_MediaPicker } from './FP_MediaPicker';
export { default as FP_MediaRefField } from './FP_MediaRefField';
export { default as FP_PhonePreview, FP_PREVIEW_SCREENS } from './FP_PhonePreview';
export { default as FP_ChartCard } from './FP_ChartCard';
export { default as FP_Sidebar } from './FP_Sidebar';
export { default as FP_Topbar } from './FP_Topbar';
export { default as FP_AppShell } from './FP_AppShell';
export { default as FP_NotificationsBell } from './FP_NotificationsBell';
export { default as FP_UserMenu } from './FP_UserMenu';

/* types */
export type { FP_ButtonProps, FP_ButtonVariant } from './FP_Button';
export type { FP_TableColumn, FP_TableProps } from './FP_Table';
export type { FP_BadgeTone } from './FP_Badge';
export type { FP_SocketStatus } from './FP_StatusDot';
export type { FP_ToastApi } from './FP_ToastProvider';
