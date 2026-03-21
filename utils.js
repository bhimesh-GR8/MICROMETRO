'use strict';

export function lerp(start, end, factor) {
  return start + (end - start) * factor;
}

export function pointToSegmentDistance(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const lengthSquared = dx * dx + dy * dy;

  if (!lengthSquared) {
    return {
      distance: Math.hypot(px - ax, py - ay),
      interpolation: 0
    };
  }

  let t = ((px - ax) * dx + (py - ay) * dy) / lengthSquared;
  t = Math.max(0, Math.min(1, t));

  return {
    distance: Math.hypot(px - (ax + t * dx), py - (ay + t * dy)),
    interpolation: t
  };
}

export function findBestInsertSegment(line, sx, sy) {
  let bestIndex = -1;
  let bestDistance = Infinity;

  for (let i = 0; i < line.stations.length - 1; i++) {
    const stationA = line.stations[i];
    const stationB = line.stations[i + 1];
    const { distance } = pointToSegmentDistance(sx, sy, stationA.x, stationA.y, stationB.x, stationB.y);

    if (distance < bestDistance) {
      bestDistance = distance;
      bestIndex = i;
    }
  }

  return {
    segmentIndex: bestIndex,
    distance: bestDistance
  };
}

export function drawShape(context, shapeType, x, y, size) {
  context.beginPath();

  if (shapeType === 'circle') {
    context.arc(x, y, size, 0, Math.PI * 2);
  } else if (shapeType === 'square') {
    const halfSize = size * 1.05;
    context.rect(x - halfSize, y - halfSize, halfSize * 2, halfSize * 2);
  } else if (shapeType === 'triangle') {
    const halfSize = size * 1.15;
    context.moveTo(x, y - halfSize * 1.1);
    context.lineTo(x + halfSize, y + halfSize * 0.7);
    context.lineTo(x - halfSize, y + halfSize * 0.7);
    context.closePath();
  }
}

export function drawRoundedRect(context, x, y, width, height, radius) {
  context.beginPath();
  context.moveTo(x + radius, y);
  context.lineTo(x + width - radius, y);
  context.quadraticCurveTo(x + width, y, x + width, y + radius);
  context.lineTo(x + width, y + height - radius);
  context.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  context.lineTo(x + radius, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - radius);
  context.lineTo(x, y + radius);
  context.quadraticCurveTo(x, y, x + radius, y);
  context.closePath();
}
