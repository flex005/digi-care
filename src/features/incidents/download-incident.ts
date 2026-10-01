import { jsPDF } from 'jspdf'
import type { IncidentPdfContent } from './incident-pdf'

/**
 * Writing the assembled content to a file.
 *
 * **Separate from `incidentPdfContent` on purpose.** What the document says is
 * a question a test can answer; what jsPDF does with it is not. Keeping the
 * two apart means the thing worth asserting — that every recorded fact reaches
 * the page, and that what cannot reach it is named — is assertable without a
 * PDF parser.
 *
 * This half is deliberately thin: layout, pagination and the image calls, and
 * no decisions about what to include.
 */

const MARGIN = 14
const WIDTH = 182
const BOTTOM = 280

/** How wide a photograph is drawn, and the height it keeps in proportion. */
const PHOTO_WIDTH = 120

export async function downloadIncidentPdf(content: IncidentPdfContent): Promise<void> {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  let y = MARGIN

  const page = (needed: number) => {
    if (y + needed <= BOTTOM) return
    doc.addPage()
    y = MARGIN
  }

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.text(content.title, MARGIN, y)
  y += 10

  for (const section of content.sections) {
    page(14)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(12)
    doc.text(section.heading, MARGIN, y)
    y += 6

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    for (const line of section.lines) {
      // An empty line is a deliberate break between a field block and prose.
      if (line === '') {
        y += 3
        continue
      }
      for (const wrapped of doc.splitTextToSize(line, WIDTH) as string[]) {
        page(6)
        doc.text(wrapped, MARGIN, y)
        y += 5
      }
    }
    y += 5
  }

  /*
   * The photographs themselves, after everything that is said about them.
   *
   * A file that cannot be read is skipped rather than failing the download: a
   * reader who gets the record with one image missing is better served than
   * one who gets nothing, and the section above has already named every
   * photograph by filename, so an absent image is visible rather than silent.
   */
  for (const photo of content.photos) {
    const data = await readAsDataUrl(photo.url)
    if (data === 'unreadable') continue
    const { width, height } = await sizeOf(data)
    const drawn = (PHOTO_WIDTH * height) / width
    page(drawn + 10)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.text(photo.fileName, MARGIN, y)
    y += 4
    doc.addImage(data, MARGIN, y, PHOTO_WIDTH, drawn)
    y += drawn + 8
  }

  doc.save(content.fileName)
}

/** The object URL's bytes, or the fact that they could not be read. */
async function readAsDataUrl(url: string): Promise<string | 'unreadable'> {
  try {
    const blob = await (await fetch(url)).blob()
    return await new Promise<string>((done, fail) => {
      const reader = new FileReader()
      reader.onload = () => {
        done(String(reader.result))
      }
      reader.onerror = () => {
        fail(new Error('unreadable'))
      }
      reader.readAsDataURL(blob)
    })
  } catch {
    return 'unreadable'
  }
}

/** Measured rather than assumed, so a photograph is not drawn stretched. */
function sizeOf(dataUrl: string): Promise<{ width: number; height: number }> {
  return new Promise((done) => {
    const image = new Image()
    image.onload = () => {
      done({ width: image.naturalWidth || 1, height: image.naturalHeight || 1 })
    }
    image.onerror = () => {
      done({ width: 1, height: 1 })
    }
    image.src = dataUrl
  })
}
