import { parseWorkbookFile } from './parseWorkbookFile'
import { validateWorkbook } from './validation/validateWorkbook'

export async function processWorkbookUpload(file) {
  const workbookData = await parseWorkbookFile(file)
  const validation = validateWorkbook(workbookData)

  return {
    workbookData,
    validation,
  }
}