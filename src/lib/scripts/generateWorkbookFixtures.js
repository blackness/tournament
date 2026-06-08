import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'
import { generateTournamentWorkbookDraft } from '../workbook/generateTournamentWorkbookDraft.js'
import { WORKBOOK_PRESETS } from '../workbook/sampleWorkbookPresets.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

async function main() {
  const outputDir = path.resolve(__dirname, '../../../test-fixtures/workbooks')
  await fs.mkdir(outputDir, { recursive: true })

  for (const preset of WORKBOOK_PRESETS) {
    const result = await generateTournamentWorkbookDraft(preset.config)
    const outputPath = path.join(outputDir, preset.fileName)

    await fs.writeFile(outputPath, Buffer.from(result.buffer))
    console.log(`Wrote ${outputPath}`)
  }

  console.log(`Generated ${WORKBOOK_PRESETS.length} workbook fixture(s).`)
}

main().catch(err => {
  console.error('Failed to generate workbook fixtures:', err)
  process.exit(1)
})