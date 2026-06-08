import { addStyledHeaderRow, autoSizeColumns } from './sheetUtils.js'

export function buildPoolsSheet(workbook, config, derived) {
  const ws = workbook.addWorksheet('Pools')

  addStyledHeaderRow(ws, [
    'example_row',
    'division_name',
    'pool_name',
    'pool_short_name',
    'sort_order',
  ])

  const allPools = derived.divisions.flatMap(division =>
    division.pools.map(pool => ({
      divisionName: division.name,
      pool,
    }))
  )

  if (allPools.length === 0) {
    ws.addRow([
      'TRUE',
      'U19 Girls',
      'Pool A',
      'A',
      1,
    ])
  } else {
    allPools.forEach(({ divisionName, pool }) => {
      ws.addRow([
        '',
        divisionName,
        pool.name,
        pool.shortName,
        pool.sortOrder,
      ])
    })
  }

  autoSizeColumns(ws)
}