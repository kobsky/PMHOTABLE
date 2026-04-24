export type VelocityZone = 'green' | 'yellow' | 'red'

export interface ToleranceBands {
  greenMin: number
  greenMax: number
  yellowMin: number
  yellowMax: number
}

export function calculateBands(target: number, tolerancePercent: number): ToleranceBands {
  const tolerance = target * (tolerancePercent / 100)
  return {
    greenMin: target - tolerance,
    greenMax: target + tolerance,
    yellowMin: target - 2 * tolerance,
    yellowMax: target + 2 * tolerance,
  }
}

export function getZone(actual: number, target: number, tolerancePercent: number): VelocityZone {
  const { greenMin, greenMax, yellowMin, yellowMax } = calculateBands(target, tolerancePercent)
  if (actual >= greenMin && actual <= greenMax) return 'green'
  if (actual >= yellowMin && actual <= yellowMax) return 'yellow'
  return 'red'
}

export function getZoneLabel(zone: VelocityZone): string {
  switch (zone) {
    case 'green': return 'W sam raz'
    case 'yellow': return 'Na granicy'
    case 'red': return 'Poza widełkami'
  }
}
