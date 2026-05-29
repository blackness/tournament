import { addStyledHeaderRow, autoSizeColumns } from './sheetUtils'

export function buildPoolsSheet(workbook, config, derived) {
  const ws = workbook.addWorksheet('Pools')

  addStyledHeaderRow(ws, [
    'division_name',
    'pool_name',
    'pool_short_name',
    'sort_order',
  ])

  derived.divisions.forEach(division => {
    division.pools.forEach(pool => {
      ws.addRow([
        division.name,
        pool.name,
        pool.shortName,
        pool.sortOrder,
      ])
    })
  })

  autoSizeColumns(ws)
}