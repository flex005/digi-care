import { useState } from 'react'
import {
  Accordion,
  AccordionSection,
  AlertDialog,
  Button,
  Checkbox,
  Dialog,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Popover,
  PopoverContent,
  PopoverTrigger,
  RadioGroup,
  Select,
  Switch,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Toast,
  Tooltip,
} from '@/components/primitives'
import { Icon } from '@/components/icon/Icon'
import styles from './dev.module.css'

/**
 * The hand-authored primitives, in their states. PRD §3.2.
 *
 * Two things worth checking here rather than trusting:
 *   - Dialog and AlertDialog cannot be built without a title, and the titles
 *     below name the subject, per PRD §2.4. There is no "Are you sure?".
 *   - RadioGroup and Select start with NO selection, because several gates in
 *     this product must not pre-answer their own question.
 */
export function PrimitiveGallery() {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [alertOpen, setAlertOpen] = useState(false)
  const [toastOpen, setToastOpen] = useState(false)
  const [checked, setChecked] = useState(false)
  const [switched, setSwitched] = useState(false)
  const [radio, setRadio] = useState<string | undefined>(undefined)
  const [selected, setSelected] = useState<string | undefined>(undefined)

  return (
    <section className={styles.section}>
      <h2 className={styles.sectionTitle}>Primitives</h2>
      <p className={styles.sectionNote}>
        Hand-authored wrappers over Radix, styled to our tokens from the first line. The
        shadcn CLI is not used in this project: it installs an icon library and
        overwrites the stylesheet, and both break hard rules here.
      </p>

      <div className={styles.group}>
        <span className={styles.groupTitle}>Button: variants and sizes</span>
        <div className={styles.row}>
          <Button variant="primary">Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="destructive" size="large">
            Destructive (44px target)
          </Button>
          <Button disabled>Disabled</Button>
          <Button variant="secondary" size="small">
            Small
          </Button>
          <Button>
            <Icon name="add-remove-delete/add-01" size={16} />
            With icon
          </Button>
        </div>
      </div>

      <div className={styles.group}>
        <span className={styles.groupTitle}>Overlays</span>
        <div className={styles.row}>
          <Button variant="secondary" onClick={() => setDialogOpen(true)}>
            Open dialog
          </Button>
          <Button variant="secondary" onClick={() => setAlertOpen(true)}>
            Open confirmation
          </Button>
          <Button variant="secondary" onClick={() => setToastOpen(true)}>
            Show toast
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="secondary">Dropdown menu</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuLabel>Actions</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem>Add care note</DropdownMenuItem>
              <DropdownMenuItem>Record medication</DropdownMenuItem>
              <DropdownMenuItem disabled>Export (later phase)</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="secondary">Popover</Button>
            </PopoverTrigger>
            <PopoverContent>
              <p style={{ padding: 'var(--space-8)' }}>
                Popovers hold supplementary detail, never the only copy of a clinical
                value.
              </p>
            </PopoverContent>
          </Popover>

          <Tooltip content="Tooltips are never the only place information lives.">
            <Button variant="ghost">Hover for tooltip</Button>
          </Tooltip>
        </div>
      </div>

      <div className={styles.group}>
        <span className={styles.groupTitle}>
          Form controls: nothing starts pre-answered
        </span>
        <div className={styles.row}>
          <Checkbox
            label="Flag this note for review"
            checked={checked}
            onCheckedChange={setChecked}
          />
          <Switch
            label="Collapse sidebar by default"
            checked={switched}
            onCheckedChange={setSwitched}
          />
          <Select
            label="Not-given reason"
            placeholder="Choose a reason"
            value={selected}
            onValueChange={setSelected}
            options={[
              { value: 'resident_refused', label: 'Resident refused' },
              { value: 'resident_asleep', label: 'Resident asleep' },
              { value: 'medication_unavailable', label: 'Medication unavailable' },
              { value: 'resident_in_hospital', label: 'Resident in hospital' },
              { value: 'other', label: 'Other' },
            ]}
          />
        </div>
        <div className={styles.stack}>
          <RadioGroup
            legend="CQC notification decision"
            value={radio}
            onValueChange={setRadio}
            options={[
              { value: 'required', label: 'Notification required' },
              { value: 'not_required', label: 'Notification not required' },
              { value: 'not_decided', label: 'Not yet decided' },
            ]}
          />
        </div>
      </div>

      <div className={styles.group}>
        <span className={styles.groupTitle}>Tabs</span>
        <Tabs defaultValue="general">
          <TabsList>
            <TabsTrigger value="general">General Information</TabsTrigger>
            <TabsTrigger value="needs">Needs</TabsTrigger>
            <TabsTrigger value="people">Important People</TabsTrigger>
          </TabsList>
          <TabsContent value="general">
            Tab panels get their content in Phase 1.
          </TabsContent>
          <TabsContent value="needs">
            Needs is generated from care plan domains.
          </TabsContent>
          <TabsContent value="people">
            Next of kin, LPA holder, professionals.
          </TabsContent>
        </Tabs>
      </div>

      <div className={styles.group}>
        <span className={styles.groupTitle}>Accordion</span>
        <Accordion type="single" collapsible>
          <AccordionSection
            value="one"
            title="Collapsing is for detail, never for status"
          >
            A collapsed section is indistinguishable from an absent one at a glance, so
            no risk badge, omission or Insufficient Evidence panel may live behind a
            disclosure.
          </AccordionSection>
          <AccordionSection
            value="two"
            title="Radix supplies the roles and keyboard behaviour"
          >
            Focus management, Escape handling and ARIA come from Radix. We style; we do
            not fight it.
          </AccordionSection>
        </Accordion>
      </div>

      <Dialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title="Add a care note for Emmanuel Okafor"
        description="The subject is named in the title because the second-worst failure available is a record saved against the wrong resident."
        actions={
          <>
            <Button variant="secondary" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => setDialogOpen(false)}>Add note</Button>
          </>
        }
      />

      <AlertDialog
        open={alertOpen}
        onOpenChange={setAlertOpen}
        subject={{ kind: 'resident', name: 'Emmanuel Okafor', room: '14' }}
        action="Record 08:00 medications"
        description="Amlodipine 5mg and Atorvastatin 20mg will be recorded as given at 08:04 by A. Okonkwo. This cannot be edited afterwards; a correction creates a new linked record."
        confirmLabel="Record medications"
        onConfirm={() => setAlertOpen(false)}
      />

      <Toast
        open={toastOpen}
        onOpenChange={setToastOpen}
        tone="positive"
        title="Care note saved"
        description="Recorded for Emmanuel Okafor at 08:04 by A. Okonkwo."
      />
    </section>
  )
}
