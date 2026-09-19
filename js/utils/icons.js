/** SVG icon registry + render helper */
const SHAPES = {
  logo: {
    paths: ['M12 2.5 L21 12 L12 21.5 L3 12 Z', 'M12 7.5 L16.5 12 L12 16.5 L7.5 12 Z'],
  },
  home: {
    paths: ['M3.5 10.5 L12 3.5 L20.5 10.5', 'M5.5 9.5 V20 H18.5 V9.5', 'M9.5 20 V13.5 H14.5 V20'],
  },
  blog: {
    paths: ['M4 4 H17 A3 3 0 0 1 20 7 V20 H6 A2 2 0 0 1 4 18 Z', 'M8 8 H14', 'M8 12 H13'],
  },
  portfolio: { paths: ['M3 17 L8 12 L12 15 L17 9 L21 13', 'M3 20 H21'] },
  alerts: {
    paths: ['M12 3 L13 6 H18 L14.5 9 L16 14 L12 11 L8 14 L9.5 9 L6 6 H11 Z'],
    circles: [[12, 17, 1]],
  },
  settings: {
    paths: [
      'M12 8.5 A3.5 3.5 0 1 0 12 15.5 A3.5 3.5 0 1 0 12 8.5',
      'M19 13.5 V10.5 L17.2 10 L16.6 8.5 L17.7 6.8 L15.2 5.2 L13.9 6.5 L12.3 6.1 L11.8 4.5 H8.2 L7.7 6.1 L6.1 6.5 L4.8 5.2 L2.3 6.8 L3.4 8.5 L2.8 10 L1 10.5 V13.5 L2.8 14 L3.4 15.5 L2.3 17.2 L4.8 18.8 L6.1 17.5 L7.7 17.9 L8.2 19.5 H11.8 L12.3 17.9 L13.9 17.5 L15.2 18.8 L17.7 17.2 L16.6 15.5 L17.2 14 Z',
    ],
  },
  login: {
    paths: ['M10 4 H5 A1 1 0 0 0 4 5 V19 A1 1 0 0 0 5 20 H10', 'M14 8 L18 12 L14 16', 'M8 12 H18'],
  },
  write: { paths: ['M12 19 H20', 'M16.5 3.5 A2.1 2.1 0 0 1 20.5 7.5 L8 20 H4 V16 Z'] },
  refresh: { paths: ['M20 12 A8 8 0 1 1 4 12', 'M20 4 V12 H12'] },
  chart: { paths: ['M3 3 V21 H21', 'M7 15 L10 11 L13 13 L17 7'] },
  coins: {
    paths: [
      'M8 10 A4 4 0 1 1 8 18 A4 4 0 1 1 8 10',
      'M15 7 A4 4 0 1 1 15 15',
    ],
  },
  comments: {
    paths: [
      'M20 15 A3 3 0 0 1 17 18 H8 L4 21 V18 A3 3 0 0 1 4 12 V9 A3 3 0 0 1 7 6 H17 A3 3 0 0 1 20 9 Z',
      'M8 9.5 H14',
      'M8 12.5 H12',
    ],
  },
  btc: {
    paths: [
      'M9 5 L9 19',
      'M12 5 L12 19',
      'M6 8 H11 A2.5 2.5 0 0 1 11 13 H7 A2.5 2.5 0 0 1 7 18 H12',
      'M7 18 H15',
    ],
  },
  trend: { paths: ['M3 17 L8 12 L12 15 L21 6', 'M15 6 H21 V12'] },
  arrow: { paths: ['M5 12 H19', 'M13 6 L19 12 L13 18'] },
  calendar: { paths: ['M4 6 H20 V20 H4 Z', 'M8 3 V8', 'M16 3 V8', 'M4 10 H20'] },
  shield: { paths: ['M12 3 L20 6 V11 C20 16 16.5 19.5 12 21 C7.5 19.5 4 16 4 11 V6 Z'] },
  spark: { paths: ['M12 2 L13.5 9 L20 12 L13.5 15 L12 22 L10.5 15 L4 12 L10.5 9 Z'] },
  search: {
    paths: [
      'M10.5 4 A6.5 6.5 0 1 0 10.5 17 A6.5 6.5 0 1 0 10.5 4',
      'M15.5 15.5 L20 20',
    ],
  },
  close: { lines: [[6, 6, 18, 18], [18, 6, 6, 18]] },
};

export function icon(name, size = 20, strokeWidth = 1.7) {
  const shape = SHAPES[name] || SHAPES.spark;
  const parts = [];
  for (const d of shape.paths || []) parts.push(`<path d="${d}"/>`);
  for (const [cx, cy, r] of shape.circles || []) parts.push(`<circle cx="${cx}" cy="${cy}" r="${r}"/>`);
  for (const [x1, y1, x2, y2] of shape.lines || []) parts.push(`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>`);
  return `<svg class="app-icon" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${parts.join('')}</svg>`;
}
