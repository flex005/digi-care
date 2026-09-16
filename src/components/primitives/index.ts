/**
 * Hand-authored primitives over Radix, styled to our tokens from the first
 * line. PRD §3.2, CLAUDE.md §5.
 *
 * The shadcn CLI is NOT run in this project: it installs lucide-react and
 * overwrites the stylesheet with its own tokens, both of which break hard
 * rules here. Reading its source as a reference for Radix composition is
 * fine; copying its stylesheet, token names or dependency list is not.
 */

export { Avatar } from './Avatar'
export type { AvatarProps, AvatarSize } from './Avatar'

export { Button, buttonClassName } from './Button'
export type { ButtonProps, ButtonSize, ButtonVariant } from './Button'

export { Card, CardHeader } from './Card'
export type { CardProps, CardHeaderProps } from './Card'

export { Section } from './Section'
export type { SectionProps } from './Section'

export { EmptyState } from './EmptyState'
export type { EmptyStateProps } from './EmptyState'

export { Table, TableRow, TableCell } from './Table'
export type { SortDirection, TableColumn, TableProps } from './Table'

export { Dialog, DialogTrigger, DialogClose } from './Dialog'
export type { DialogProps } from './Dialog'

export { AlertDialog, AlertDialogTrigger } from './AlertDialog'
export type { AlertDialogProps, ConfirmationSubject } from './AlertDialog'

export {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from './DropdownMenu'

export { Select } from './Select'
export type { SelectOption, SelectProps } from './Select'

export { Tabs, TabsList, TabsTrigger, TabsContent } from './Tabs'

export { Tooltip, TooltipProvider } from './Tooltip'
export type { TooltipProps } from './Tooltip'

export { Popover, PopoverTrigger, PopoverContent, PopoverClose } from './Popover'

export { Checkbox } from './Checkbox'
export type { CheckboxProps } from './Checkbox'

export { RadioGroup } from './RadioGroup'
export type { RadioGroupProps, RadioOption } from './RadioGroup'

export { Switch } from './Switch'
export type { SwitchProps } from './Switch'

export { Accordion, AccordionSection } from './Accordion'
export type { AccordionSectionProps } from './Accordion'

export { Toast, ToastProvider, ToastViewport } from './Toast'
export type { ToastProps, ToastTone } from './Toast'

export { VisuallyHidden } from './VisuallyHidden'
export { SelectedMark } from './SelectedMark'
export { PasswordField } from './PasswordField'

export { Pager, usePaged, ROWS_PER_PAGE } from './Pager'
export type { Paged } from './Pager'
