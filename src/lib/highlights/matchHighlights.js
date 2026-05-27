export function getMatchHighlight(matchCode) {
  if (matchCode === 'P24') {
    return {
      label: 'Gold Medal',
      color: '#fbbf24',
      bg: 'rgba(251,191,36,0.10)',
      badgeBg: 'rgba(251,191,36,0.14)',
      border: 'rgba(251,191,36,0.45)',
      shadow: 'rgba(251,191,36,0.14)',
    }
  }

  if (matchCode === 'P23') {
    return {
      label: 'Bronze Medal',
      color: '#fb923c',
      bg: 'rgba(249,115,22,0.10)',
      badgeBg: 'rgba(249,115,22,0.14)',
      border: 'rgba(249,115,22,0.42)',
      shadow: 'rgba(249,115,22,0.12)',
    }
  }

  if (matchCode === 'P17') {
    return {
      label: 'Consolation Final',
      color: '#22c55e',
      bg: 'rgba(34,197,94,0.10)',
      badgeBg: 'rgba(34,197,94,0.14)',
      border: 'rgba(34,197,94,0.40)',
      shadow: 'rgba(34,197,94,0.12)',
    }
  }

  return null
}