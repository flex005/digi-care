import { useState } from 'react'
import { Button, Dialog } from '@/components/primitives'
import { Icon } from '@/components/icon/Icon'

/**
 * MAR PDF export. PRD §6.4 — stubbed in this build.
 *
 * **Never a silent no-op.** On a screen whose whole job is evidence, an export
 * that appears to have happened and did not is a record somebody believes
 * exists, so pressing it says that nothing was produced.
 */
export function ExportControl() {
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button variant="secondary" size="small" onClick={() => setOpen(true)}>
        <Icon name="download-upload/download-01" size={16} aria-hidden />
        Export PDF
      </Button>

      <Dialog
        open={open}
        onOpenChange={setOpen}
        title="The MAR chart cannot be exported yet"
        description="Nothing has been produced."
        actions={
          <Button variant="secondary" onClick={() => setOpen(false)}>
            Close
          </Button>
        }
      />
    </>
  )
}
