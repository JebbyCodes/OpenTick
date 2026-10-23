/* OpenTick views: all rendering lives here */
const IC = {
  inbox: '<polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>',
  sun: '<circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>',
  sunrise: '<path d="M17 18a5 5 0 0 0-10 0"/><line x1="12" y1="2" x2="12" y2="9"/><line x1="1" y1="18" x2="3" y2="18"/><line x1="21" y1="18" x2="23" y2="18"/><line x1="23" y1="22" x2="1" y2="22"/><polyline points="8 6 12 2 16 6"/>',
  calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
  layers: '<polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/>',
  'check-circle': '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>',
  trash: '<polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6m5 0V4a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v2"/>',
  slash: '<circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/>',
  grid: '<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>',
  activity: '<polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>',
  circle: '<circle cx="12" cy="12" r="9"/>',
  bold: '<path d="M6 4h8a4 4 0 0 1 0 8H6z"/><path d="M6 12h9a4 4 0 0 1 0 8H6z"/>',
  italic: '<line x1="19" y1="4" x2="10" y2="4"/><line x1="14" y1="20" x2="5" y2="20"/><line x1="15" y1="4" x2="9" y2="20"/>',
  strike: '<line x1="4" y1="12" x2="20" y2="12"/><path d="M16.5 7.2C16 5.5 14.3 4.5 12 4.5c-2.6 0-4.5 1.2-4.5 3.1 0 1.1.7 1.9 1.8 2.4"/><path d="M14.8 14.2c1 .5 1.7 1.3 1.7 2.3 0 2-2 3-4.5 3-2.4 0-4.2-1-4.7-2.8"/>',
  heading: '<path d="M5 5v14"/><path d="M19 5v14"/><path d="M5 12h14"/>',
  'list-ol': '<line x1="11" y1="6" x2="21" y2="6"/><line x1="11" y1="12" x2="21" y2="12"/><line x1="11" y1="18" x2="21" y2="18"/><path d="M4 5.5l1.5-1V9"/><path d="M4 14.5c0-1 1-1.5 1.7-1.5s1.4.5 1.4 1.3c0 1.2-2.2 1.6-3.1 3.2h3.2"/>',
  quote: '<path d="M5 17v-5.5a3 3 0 0 1 3-3h1"/><path d="M5 12h4v5H5z"/><path d="M14 17v-5.5a3 3 0 0 1 3-3h1"/><path d="M14 12h4v5h-4z"/>',
  highlight: '<path d="M14.5 5.5l4 4L10 18H6v-4z"/><path d="M4 21h8"/>',
  printer: '<polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/>',
  'book-open': '<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>',
  info: '<circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>',
  copy: '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
  sparkles: '<path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z"/>',
  minus: '<line x1="5" y1="12" x2="19" y2="12"/>',
  clock: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
  search: '<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>',
  plus: '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',
  menu: '<line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/>',
  sliders: '<line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/>',
  repeat: '<polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/>',
  bell: '<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>',
  x: '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
  left: '<polyline points="15 18 9 12 15 6"/>',
  right: '<polyline points="9 18 15 12 9 6"/>',
  down: '<polyline points="6 9 12 15 18 9"/>',
  list: '<line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>',
  columns: '<path d="M12 3h7a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-7m0-18H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h7m0-18v18"/>',
  tag: '<path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/>',
  flag: '<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/>',
  more: '<circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/>',
  check: '<polyline points="20 6 9 17 4 12"/>',
  'file-text': '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>',
  'check-square': '<polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>',
  cloud: '<path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/>',
  'cloud-off': '<path d="M22.61 16.95A5 5 0 0 0 18 10h-1.26a8 8 0 0 0-7.05-6M5 5a8 8 0 0 0 4 15h9a5 5 0 0 0 1.7-.3"/><line x1="1" y1="1" x2="23" y2="23"/>',
  refresh: '<polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>',
  link: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
  gantt: '<line x1="3" y1="6" x2="13" y2="6"/><line x1="8" y1="12" x2="20" y2="12"/><line x1="5" y1="18" x2="15" y2="18"/>',
  table: '<rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="9" y1="3" x2="9" y2="21"/>',
  pin: '<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>',
  alert: '<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>',
  up: '<polyline points="18 15 12 9 6 15"/>',
  'panel-left': '<rect x="3" y="3" width="18" height="18" rx="2"/><line x1="9" y1="3" x2="9" y2="21"/>',
  'panel-right': '<rect x="3" y="3" width="18" height="18" rx="2"/><line x1="15" y1="3" x2="15" y2="21"/>',
  'zoom-in': '<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/>',
  'zoom-out': '<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="8" y1="11" x2="14" y2="11"/>',
  fit: '<path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/>',
  grip: '<circle cx="9" cy="6" r="1"/><circle cx="15" cy="6" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="9" cy="18" r="1"/><circle cx="15" cy="18" r="1"/>',
  expand: '<polyline points="7 13 12 18 17 13"/><polyline points="7 6 12 11 17 6"/>',
  collapse: '<polyline points="17 11 12 6 7 11"/><polyline points="17 18 12 13 7 18"/>',
  focus: '<circle cx="12" cy="12" r="3"/><path d="M3 8V5a2 2 0 0 1 2-2h3m8 0h3a2 2 0 0 1 2 2v3m0 8v3a2 2 0 0 1-2 2h-3m-8 0H5a2 2 0 0 1-2-2v-3"/>',
  shrink: '<path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"/>',
  volume: '<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/>',
  'volume-x': '<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/>',
  star: '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>',
  upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>',
  flame: '<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.07-2.14-.22-4.05 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.15.43-2.29 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>',
  'arrow-up': '<line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/>',
  'arrow-down': '<line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/>',
  history: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><polyline points="3 3 3 8 8 8"/><polyline points="12 7 12 12 15 14"/>',
  folder: '<path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>',
  home: '<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>',
  briefcase: '<rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>',
  book: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>',
  cart: '<circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>',
  heart: '<path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>',
  zap: '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>',
  target: '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>',
  music: '<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>',
  camera: '<path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/>',
  code: '<polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>',
  gift: '<polyline points="20 12 20 22 4 22 4 12"/><rect x="2" y="7" width="20" height="5"/><line x1="12" y1="22" x2="12" y2="7"/><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/>',
  coffee: '<path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/><line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/>',
  dollar: '<line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>',
  user: '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
  users: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  tool: '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>',
  globe: '<circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>',
  send: '<line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>',
  bookmark: '<path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>',
  play: '<polygon points="7 4 20 12 7 20 7 4" fill="currentColor"/>',
  pause: '<rect x="6" y="4" width="4" height="16" rx="1" fill="currentColor"/><rect x="14" y="4" width="4" height="16" rx="1" fill="currentColor"/>',
  'cloud-check': '<path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/><polyline points="9.5 14.5 11.5 16.5 15.5 12"/>',
  paperclip: '<path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>',
  image: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>',
  notes: '<path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>',
};
const ic = (n, s = 18) => `<svg class="ic" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${IC[n] || ''}</svg>`;

// the coin from the app icon, cropped for small round spots (sidebar, About); the full square is used for favicons and app icons
const logoHtml = (n = 28) => `<span class="logo" style="width:${n}px;height:${n}px"><img src="${esc(APP_LOGO)}" alt=""></span>`;
// icons offered for lists and projects (an emoji can be used instead)
const LIST_ICONS = ['list', 'inbox', 'sun', 'calendar', 'star', 'flag', 'heart', 'home', 'briefcase', 'book', 'cart', 'folder', 'target', 'zap', 'music', 'camera', 'code', 'gift', 'coffee', 'dollar', 'user', 'users', 'tool', 'globe', 'send', 'bookmark', 'bell', 'clock', 'tag', 'file-text', 'layers', 'flame'];
const listIcon = (o, n = 18) => { const i = o && o.icon; return i && IC[i] ? ic(i, n) : i ? `<span class="emo" style="font-size:${Math.round(n * 0.9)}px">${esc(i)}</span>` : ic(o && o.listIds ? 'layers' : 'list', n); };
const U = { projList: {}, tagSel: [], tagMode: 'all', hist: { acts: [], kinds: [], q: '', sort: 'new', shown: 150 },  page: 'tasks', nav: 'today', q: '', sel: null, calD: new Date(), fx: [], showDone: {}, drag: null, _rn: null, ttDate: null, ttTray: null, ttV: null };
const SMART = [['inbox', 'Inbox', 'inbox'], ['today', 'Today', 'sun'], ['tomorrow', 'Tomorrow', 'sunrise'], ['week', 'Next 7 Days', 'calendar'], ['all', 'All', 'layers']];
const PAGES = [['home', 'Projects', 'dashboard'], ['tasks', 'Tasks', 'check-circle'], ['notes', 'Notes', 'notes'], ['calendar', 'Calendar', 'calendar'], ['timetable', 'Timetable', 'table'], ['gantt', 'Gantt', 'gantt'], ['matrix', 'Matrix', 'grid'], ['habits', 'Habit', 'activity'], ['focus', 'Focus', 'clock']];
const FLAT = ['done', 'trash', 'wontdo', 'search'];
// inline markdown in titles, never as links (rows are click targets)
const FULLDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
// a tag is a coloured pill when it has a colour, plain muted text otherwise
const tagChip = g => { const c = tagColor(g); return `<span class="tag"${c ? ` style="--tc:${c}"` : ''}>#${esc(g)}</span>`; };
// duration + timetable-slot badges shown in a task's meta line
function metaX(t) {
  const sl = t.slotId && slotById(t.slotId), sj = t.subjectId && typeof scSubj === 'function' ? scSubj(t.subjectId) : null;
  const cd = t.kind === 'exam' && t.status === 'open' && t.due ? dayDiff(t.due, todayStr()) : null; // days to go, for an exam that is still ahead
  return (t.kind ? `<span class="kb ${t.kind}" title="${t.kind === 'exam' ? 'Exam' : 'Homework'}">${ic(t.kind === 'exam' ? 'exam' : 'homework', 12)}${t.kind === 'exam' ? ` ${cd != null && cd >= 0 && cd <= 30 ? (cd === 0 ? 'Today' : cd === 1 ? 'Tomorrow' : 'In ' + cd + ' days') : 'Exam'}` : ''}</span>` : '')
    + (sj ? `<span class="slb" style="--tc:${sj.color}" title="Class">${iconAny(sj.icon, 12)} ${esc(sj.name)}</span>` : '')
    + (t.room ? `<span title="Room">${ic('pin', 12)} ${esc(t.room)}</span>` : '')
    + (t.dur ? `<span title="Duration">${ic('clock', 12)} ${fmtDur(t.dur)}</span>` : '') + (sl ? `<span class="slb" style="--tc:${sl.color}" title="Timetable slot">${ic('table', 12)} ${esc(sl.title)}</span>` : '');
}
const titleHtml = t => (t.title && t.title.trim() ? mdInline(t.title, true) : '<i>Untitled</i>');
function noteBadge(t) {
  const nl = typeof linkedNotes === 'function' ? linkedNotes(t).length : 0, nf = (t.files || []).length;
  let out = '';
  if (t.notes && t.notes.trim()) { const s = mdStats(t.notes); out += s.total ? `<span title="Checklist in notes">${ic('check-square', 12)} ${s.done}/${s.total}</span>` : `<span title="Has notes">${ic('file-text', 12)}</span>`; }
  if (nl) out += `<span title="${nl} linked note${nl === 1 ? '' : 's'}">${ic('notes', 12)} ${nl}</span>`;
  if (nf) out += `<span title="${nf} attachment${nf === 1 ? '' : 's'}">${ic('paperclip', 12)} ${nf}</span>`;
  return out;
}
const listOpts = () => [['inbox', 'Inbox'], ...listTree().map(({ l, depth }) => [l.id, '\u2003'.repeat(depth) + (depth ? '↳ ' : '') + l.name])];
const opts = (arr, cur) => arr.map(([v, n]) => `<option value="${esc(v)}"${String(cur) === String(v) ? ' selected' : ''}>${esc(n)}</option>`).join('');

/* ---------- duration and reminder entry ----------
   A duration is whole minutes (task.dur): typed as hours + minutes, or picked from presets. A reminder is "minutes before the
   due time" (task.reminder): a preset, or any amount in minutes / hours / days / weeks. Both are small widgets reused by the
   task panel, the schedule dialog and the slot editor, so each takes an id and is read back with durRead / remRead. */
const DUR_PRESETS = [15, 30, 45, 60, 90, 120, 180, 240];
const durHtml = (id, mins) => `<div class="durf" data-dur="${esc(id)}"><div class="durin"><input type="number" inputmode="numeric" class="dh" min="0" max="99" step="1" placeholder="0" value="${mins ? Math.floor(mins / 60) : ''}" aria-label="Hours"><span>h</span><input type="number" inputmode="numeric" class="dm" min="0" max="999" step="5" placeholder="0" value="${mins ? mins % 60 : ''}" aria-label="Minutes"><span>min</span><button type="button" class="btn sm" data-dp="0" title="No duration">${ic('x', 12)} Clear</button></div><div class="durp">${DUR_PRESETS.map(m => `<button type="button" class="btn sm${m === mins ? ' on' : ''}" data-dp="${m}">${fmtDur(m)}</button>`).join('')}</div></div>`;
const durRead = box => { const n = sel => Math.max(0, Math.floor(+(box.querySelector(sel) || {}).value || 0)); return Math.min(n('.dh') * 60 + n('.dm'), 99 * 60 + 59) || null; };
function durSet(box, mins) {
  const h = box.querySelector('.dh'), m = box.querySelector('.dm'); if (!h || !m) return;
  h.value = mins ? Math.floor(mins / 60) : ''; m.value = mins ? mins % 60 : '';
  durMark(box, mins);
}
const durMark = (box, mins) => (box.querySelectorAll('[data-dp]') || []).forEach(b => b.classList.toggle('on', +b.dataset.dp === mins));
const REM_PRESETS = [[0, 'On time'], [5, '5 minutes before'], [10, '10 minutes before'], [15, '15 minutes before'], [30, '30 minutes before'], [60, '1 hour before'], [120, '2 hours before'], [1440, '1 day before'], [2880, '2 days before'], [10080, '1 week before']];
const REM_UNITS = [[1, 'minutes'], [60, 'hours'], [1440, 'days'], [10080, 'weeks']];
function remParts(min) { const u = [10080, 1440, 60].find(x => min > 0 && min % x === 0) || 1; return { n: min == null ? 30 : min / u, u: min == null ? 1 : u }; }
function remLabel(min) {
  if (min == null) return 'No reminder'; if (min === 0) return 'On time';
  const { n, u } = remParts(min), name = REM_UNITS.find(x => x[0] === u)[1];
  return `${n} ${n === 1 ? name.replace(/s$/, '') : name} before`;
}
// forceCustom keeps the custom fields open after "Custom…" was chosen, even while the value happens to equal a preset
function remHtml(id, rem, forceCustom, keep) {
  const preset = rem != null && REM_PRESETS.some(x => x[0] === rem), custom = rem != null && (!preset || forceCustom), p = remParts(rem == null ? undefined : rem);
  return `<div class="remf" data-rem="${esc(id)}"><select class="rsel" aria-label="Reminder">${opts([...(keep ? [['keep', '— Keep as is —']] : []), ['', 'No reminder'], ...REM_PRESETS, ['custom', 'Custom…']], keep && rem === undefined ? 'keep' : rem == null ? '' : custom ? 'custom' : rem)}</select><div class="remc"${custom ? '' : ' hidden'}><input type="number" inputmode="decimal" class="rn" min="0" step="any" value="${p.n}" aria-label="How long before"><select class="ru" aria-label="Unit">${opts(REM_UNITS, p.u)}</select><span class="hint">before</span></div></div>`;
}
function remRead(box) {
  const v = box.querySelector('.rsel').value;
  if (v === 'keep') return undefined; // the batch editor: leave each task's reminder alone
  if (v === '') return null;
  if (v === 'custom') return Math.max(0, Math.min(Math.round((+box.querySelector('.rn').value || 0) * +box.querySelector('.ru').value), 525600));
  return +v;
}
// show the custom fields only while "Custom…" is picked
const remSync = box => { const c = box.querySelector('.remc'); if (c) c.hidden = box.querySelector('.rsel').value !== 'custom'; };

/* ---------- data scoping ---------- */
function scopeTasks(nav) {
  const td = todayStr(), tm = ymd(addDays(new Date(), 1)), wk = ymd(addDays(new Date(), 6));
  if (nav === 'trash') return S.tasks.filter(t => t.deleted);
  let r = S.tasks.filter(t => !t.deleted);
  if (nav === 'done') return r.filter(t => t.status === 'done').sort((a, b) => (b.doneAt || 0) - (a.doneAt || 0));
  if (nav === 'wontdo') return r.filter(t => t.status === 'wontdo');
  if (nav === 'search') { const q = U.q.toLowerCase(); return r.filter(t => t.status !== 'wontdo' && (t.title + ' ' + t.notes + ' ' + t.tags.join(' ') + ' ' + (t.files || []).map(f => f.name).join(' ')).toLowerCase().includes(q)); }
  r = r.filter(t => t.status !== 'wontdo');
  if (nav === 'inbox') return r.filter(t => t.listId === 'inbox');
  if (nav === 'today') return r.filter(t => t.due && (t.status === 'open' ? t.due <= td : t.due === td));
  if (nav === 'tomorrow') return r.filter(t => t.due === tm);
  if (nav === 'week') return r.filter(t => t.due && t.due >= td && t.due <= wk);
  if (nav.startsWith('list:')) { const ids = new Set(listIds(nav.slice(5))); return r.filter(t => ids.has(t.listId)); } // a list's view includes its sublists
  if (nav.startsWith('project:')) { const p = projectOf(nav.slice(8)), ids = new Set(p ? projectListIds(p) : []); return r.filter(t => ids.has(t.listId)); }
  if (nav.startsWith('tag:')) return r.filter(t => t.tags.includes(nav.slice(4)));
  return r;
}
const openCount = nav => scopeTasks(nav).filter(t => t.status === 'open').length;
const allTags = () => [...new Set(S.tasks.filter(t => !t.deleted).flatMap(t => t.tags))].sort();
function navTitle(nav) {
  const s = SMART.find(x => x[0] === nav);
  if (s) return s[1];
  if (nav === 'done') return 'Completed';
  if (nav === 'wontdo') return "Won't Do";
  if (nav === 'trash') return 'Trash';
  if (nav === 'search') return 'Search';
  if (nav.startsWith('list:')) return listOf(nav.slice(5)).name;
  if (nav.startsWith('project:')) return (projectOf(nav.slice(8)) || { name: 'Project' }).name;
  if (nav.startsWith('tag:')) return '#' + nav.slice(4);
  return 'Tasks';
}
const dueKey = t => (t.due ? t.due + ' ' + (t.time || '00:00') : '9999');
// Each sort has a natural direction (what it did before directions existed); the arrow button next to the sort menu flips it.
const SORT_DIR = { manual: 'asc', due: 'asc', priority: 'desc', title: 'asc', created: 'desc', tags: 'asc' };
const sortDir = () => S.settings.sortDir || SORT_DIR[S.settings.sort] || 'asc';
function sortTasks(a) {
  const m = S.settings.sort, dir = sortDir() === 'desc' ? -1 : 1, tk = t => [...t.tags].sort().join(' ');
  // ascending comparators: oldest / earliest / lowest / A to Z first
  const asc = {
    manual: (x, y) => (x.order || 0) - (y.order || 0),
    due: (x, y) => dueKey(x).localeCompare(dueKey(y)) || y.priority - x.priority,
    priority: (x, y) => x.priority - y.priority || dueKey(x).localeCompare(dueKey(y)),
    title: (x, y) => x.title.localeCompare(y.title),
    created: (x, y) => x.created - y.created,
    tags: (x, y) => tk(x).localeCompare(tk(y)) || x.title.localeCompare(y.title),
  }[m] || (() => 0);
  const last = m === 'due' ? t => !t.due : m === 'tags' ? t => !t.tags.length : null; // undated / untagged tasks stay at the bottom either way round
  return [...a].sort((x, y) => { if (last) { const lx = last(x), ly = last(y); if (lx !== ly) return lx ? 1 : -1; } return dir * asc(x, y); });
}
// the tag filter (U.tagSel) narrows whatever list you are looking at: tasks that have all of the chosen tags, or any of them
const tagFiltered = a => (U.tagSel.length ? a.filter(t => (U.tagMode === 'any' ? U.tagSel.some(g => t.tags.includes(g)) : U.tagSel.every(g => t.tags.includes(g)))) : a);
function groupTasks(a, gOverride) {
  const g = gOverride || S.settings.group, td = todayStr();
  if (g === 'none') return [{ title: '', tasks: a }];
  if (g === 'tag') { // a task shows under each of its tags
    const byTag = new Map(), none = [];
    for (const t of a) { if (!t.tags.length) none.push(t); for (const x of t.tags) { if (!byTag.has(x)) byTag.set(x, []); byTag.get(x).push(t); } }
    return [...[...byTag.keys()].sort().map(x => ({ title: '#' + esc(x), tasks: byTag.get(x) })), ...(none.length ? [{ title: 'No tag', tasks: none }] : [])];
  }
  const m = new Map();
  const order = g === 'date' ? ['Overdue', 'Today', 'Tomorrow', 'Next 7 Days', 'Later', 'No Date'] : g === 'priority' ? ['High', 'Medium', 'Low', 'None'] : [listLabel('inbox'), ...listTree().map(x => listLabel(x.l.id))];
  for (const t of a) {
    let k;
    if (g === 'date') {
      if (!t.due) k = 'No Date'; else if (isOverdue(t)) k = 'Overdue';
      else { const d = dayDiff(t.due, td); k = d <= 0 ? 'Today' : d === 1 ? 'Tomorrow' : d < 7 ? 'Next 7 Days' : 'Later'; }
    } else if (g === 'priority') k = ['None', 'Low', 'Medium', 'High'][t.priority];
    else k = listLabel(listOf(t.listId).id);
    if (!m.has(k)) m.set(k, []);
    m.get(k).push(t);
  }
  return order.filter(k => m.has(k)).map(k => ({ title: esc(k), tasks: m.get(k) }));
}
const canDrag = () => S.settings.sort === 'manual' && sortDir() === 'asc' && S.settings.group === 'none' && U.page === 'tasks' && !U.q && !FLAT.includes(U.nav);

/* ---------- shell ---------- */
const topHtml = (title, tools = '') => `<header class="top"><button class="ib burger" data-act="burger" aria-label="Menu">${ic('menu', 22)}</button><h1>${title}</h1><div class="tools">${tools}</div><button class="ib pt pt-det" data-act="uitoggle" data-k="detail" title="Show / hide task details  ]" aria-label="Show or hide the task details">${ic('panel-right', 20)}</button></header>`;
function render() {
  document.body.classList.toggle('on-help', U.page === 'help'); // the print rules for the Help page are keyed on this
  if (typeof WIDGET !== 'undefined' && WIDGET) return renderWidget();
  if (U.gFull && U.page !== 'gantt') { U.gFull = false; document.body.classList.remove('gtfull'); try { if (document.fullscreenElement) document.exitFullscreen(); } catch (e) { /* not in full screen */ } }
  if (U.nFull && (U.page !== 'notes' || !U.noteSel)) { U.nFull = false; document.body.classList.remove('nfull'); }
  document.body.classList.toggle('pg-notes', U.page === 'notes' || U.page === 'history'); // the Notes page uses the whole width: no details panel
  renderSide(); renderMain(); renderDetail(); renderTabbar();
}
// phone navigation: the first views as bottom tabs, "More" opens the full menu
function renderTabbar() {
  const el = $('#tabbar'); if (!el) return;
  const shown = pagesShown(), main = shown.slice(0, 4), cur = PAGES.find(p => p[0] === U.page);
  const items = main.some(p => p[0] === U.page) || !cur ? main : [...main.slice(0, 3), cur];
  el.innerHTML = items.map(([k, n, i]) => `<button class="${U.page === k ? 'on' : ''}" data-act="page" data-page="${k}">${ic(i, 22)}<small>${n}</small></button>`).join('') + `<button data-act="burger">${ic('menu', 22)}<small>More</small></button>`;
}
function renderTimetable() { schoolOn() ? renderSchool() : renderTimetablePlan(); }
function renderMain() { if (typeof WIDGET !== 'undefined' && WIDGET) return renderWidget(); ({ home: renderHome, tasks: renderTasks, notes: renderNotes, calendar: renderCal, timetable: renderTimetable, gantt: renderGantt, matrix: renderMatrix, habits: renderHabits, help: renderHelp, focus: renderFocus, history: renderHistory })[U.page](); fxFlush(); if (typeof batchPaint === 'function') batchPaint(); }

function renderSide() {
  const q = $('#q'), keep = q ? q.value : '';
  const on = k => U.page === 'tasks' && ((U.nav === k && !U.q) || (k.startsWith('tag:') && U.tagSel.includes(k.slice(4)))) ? ' on' : '';
  const item = (key, label, icon, color, count, extra = '') => `<button class="nav${on(key)}" data-act="nav" data-nav="${esc(key)}"${extra}><span class="ni"${color ? ` style="color:${color}"` : ''}>${ic(icon, 18)}</span><span class="nl">${esc(label)}</span>${count ? `<span class="cnt">${count}</span>` : ''}</button>`;
  const sec = (k, title, add = '') => `<div class="sec"><button class="sech" data-act="fold" data-k="${k}" aria-expanded="${!folded(k)}">${ic(folded(k) ? 'right' : 'down', 14)}<span>${title}</span></button>${add}</div>`;
  const tags = allTags();
  // lists as a tree: a caret folds the sublists, the dots open the list menu (always visible on the selected list / on touch screens)
  const hiddenUnder = new Set(), rows = [];
  for (const { l, depth, kids } of listTree()) {
    if (l.parent && hiddenUnder.has(l.parent)) { hiddenUnder.add(l.id); continue; }
    if (kids && folded('l:' + l.id)) hiddenUnder.add(l.id);
    const key = 'list:' + l.id, n = openCount(key);
    rows.push(`<div class="navrow${on(key) ? ' on' : ''}" data-lid="${esc(l.id)}" draggable="true" style="--d:${depth}">${kids ? `<button class="caret${folded('l:' + l.id) ? '' : ' open'}" data-act="fold" data-k="l:${esc(l.id)}" aria-label="${folded('l:' + l.id) ? 'Expand' : 'Collapse'} ${esc(l.name)}" aria-expanded="${!folded('l:' + l.id)}">${ic('right', 12)}</button>` : '<span class="caret sp"></span>'}<button class="nav${on(key)}" data-act="nav" data-nav="${esc(key)}" title="${esc(listLabel(l.id))}"><span class="ni" style="color:${l.color}">${listIcon(l, 18)}</span><span class="nl">${esc(l.name)}</span>${n ? `<span class="cnt">${n}</span>` : ''}</button><button class="ib sm nmore" data-act="listmenu" data-lid="${esc(l.id)}" title="List options" aria-label="Options for ${esc(l.name)}">${ic('more', 14)}</button></div>`);
  }
  const projKids = p => { // the lists a project links, with their sublists, as rows under it
    const roots = (p.listIds || []).filter(id => S.lists.some(l => l.id === id)), out = [], seen = new Set();
    const walk = (id, d) => { if (seen.has(id)) return; seen.add(id); const l = listOf(id), key = 'list:' + id, n = openCount(key), sub = S.lists.filter(x => x.parent === id && x.id !== id), shut = folded('pl:' + p.id + ':' + id);
      out.push(`<div class="navrow sub${on(key) ? ' on' : ''}" style="--d:${d + 1}">${sub.length ? `<button class="caret${shut ? '' : ' open'}" data-act="fold" data-k="pl:${esc(p.id)}:${esc(id)}" aria-label="${shut ? 'Expand' : 'Collapse'} ${esc(l.name)}" aria-expanded="${!shut}">${ic('right', 12)}</button>` : '<span class="caret sp"></span>'}<button class="nav${on(key)}" data-act="nav" data-nav="${esc(key)}" title="${esc(listLabel(id))}"><span class="ni" style="color:${l.color}">${listIcon(l, 16)}</span><span class="nl">${esc(l.name)}</span>${n ? `<span class="cnt">${n}</span>` : ''}</button></div>`);
      if (!shut) for (const c of sub) walk(c.id, d + 1); };
    for (const id of roots) walk(id, 0); return out;
  };
  const projRows = S.projects.flatMap(p => { const n = openCount('project:' + p.id), kids = (p.listIds || []).some(id => S.lists.some(l => l.id === id)), open = !!S.settings.ui.fold['pe:' + p.id];
    return [`<div class="navrow proj${on('project:' + p.id) ? ' on' : ''}" style="--d:0">${kids ? `<button class="caret${open ? ' open' : ''}" data-act="pexp" data-pid="${esc(p.id)}" aria-label="${open ? 'Collapse' : 'Expand'} ${esc(p.name)}" aria-expanded="${open}">${ic('right', 12)}</button>` : '<span class="caret sp"></span>'}<button class="nav${on('project:' + p.id)}" data-act="nav" data-nav="project:${esc(p.id)}"><span class="ni" style="color:${p.color}">${listIcon(p, 18)}</span><span class="nl">${esc(p.name)}</span>${n ? `<span class="cnt">${n}</span>` : ''}</button></div>`, ...(open ? projKids(p) : [])]; });
  $('#side').innerHTML = `
<div class="brand">${logoHtml(28)}<span class="bn"><b>OpenTick</b><small class="ver" title="Version ${esc(APP_VERSION)}">v${esc(APP_VERSION)}</small></span><button class="ib" data-act="uitoggle" data-k="side" title="${S.settings.ui.side ? 'Hide sidebar' : 'Dock sidebar'}">${ic('panel-left', 18)}</button><button class="ib" data-act="settings" title="Settings">${ic('sliders', 18)}</button></div>
<div class="search">${ic('search', 16)}<input id="q" placeholder="Search" autocomplete="off"></div>
<div class="pages">${pagesShown().map(([k, n, i]) => `<button class="pg${U.page === k ? ' on' : ''}" data-act="page" data-page="${k}" title="${n} — drag to reorder" draggable="true">${ic(i, 20)}<small>${n}</small></button>`).join('')}</div>
<div class="scroll">
${SMART.map(([k, n, i]) => item(k, n, i, null, openCount(k))).join('')}
${sec('lists', 'Lists', `<button class="ib sm" data-act="addlist" title="New list" aria-label="New list">${ic('plus', 14)}</button>`)}
${folded('lists') ? '' : rows.join('')}
${sec('projects', 'Projects', `<button class="ib sm" data-act="addproject" title="New project" aria-label="New project">${ic('plus', 14)}</button>`)}
${folded('projects') ? '' : projRows.join('') || '<p class="hint nohint">Link lists together in a project.</p>'}
${tags.length ? sec('tags', 'Tags') + (folded('tags') ? '' : tags.map(g => item('tag:' + g, g, 'tag', tagColor(g), openCount('tag:' + g))).join('')) : ''}
${sec('more', 'More')}
${folded('more') ? '' : item('done', 'Completed', 'check-circle') + item('wontdo', "Won't Do", 'slash') + item('trash', 'Trash', 'trash') + `<button class="nav${U.page === 'history' ? ' on' : ''}" data-act="page" data-page="history"><span class="ni">${ic('history', 18)}</span><span class="nl">History</span></button>`}
</div>`;
  const nq = $('#q'); if (nq) nq.value = keep || U.q;
}

/* ---------- tasks page ---------- */
// the strip at the top of a project: progress, what is in it, and the lists it links
function projHead(p, all) {
  const done = all.filter(t => t.status === 'done').length, open = all.filter(t => t.status === 'open'), late = open.filter(isOverdue).length, pct = all.length ? Math.round(done / all.length * 100) : 0;
  const chips = (p.listIds || []).filter(id => S.lists.some(l => l.id === id)).map(id => { const l = listOf(id); return `<button class="pchip" style="--c:${l.color}" data-act="nav" data-nav="list:${esc(l.id)}" title="Open ${esc(listLabel(l.id))}"><span>${listIcon(l, 13)}</span>${esc(l.name)}</button>`; }).join('');
  return `<div class="projhead" style="--c:${p.color}"><div class="pbar" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100"><i style="width:${pct}%"></i></div><div class="pstat"><b>${pct}%</b><span>${done} of ${all.length} done</span>${late ? `<span class="late">${late} overdue</span>` : ''}</div><div class="pchips">${chips || '<span class="hint">No lists linked yet</span>'}</div></div>`;
}
// multi-tag filter strip: pick several tags, then choose whether a task needs all of them or any of them
function tagBar(eff) {
  const tags = allTags(); if (!tags.length || FLAT.includes(eff) && eff !== 'search' && eff !== 'done') return '';
  const sel = U.tagSel, base = scopeTasks(eff), cnt = g => base.filter(t => t.tags.includes(g)).length;
  return `<div class="tagbar"><span class="tb-l">${ic('tag', 14)} Tags</span><div class="tb-c">${tags.map(g => `<button class="tfc${sel.includes(g) ? ' on' : ''}"${tagColor(g) ? ` style="--tc:${tagColor(g)}"` : ''} data-act="tagtoggle" data-tag="${esc(g)}" aria-pressed="${sel.includes(g)}">#${esc(g)}<small>${cnt(g)}</small></button>`).join('')}</div>${sel.length ? `<div class="seg tb-m" title="Tasks need every chosen tag, or at least one">${[['all', 'All'], ['any', 'Any']].map(([v, n]) => `<button class="${U.tagMode === v ? 'on' : ''}" data-act="tagmode" data-v="${v}">${n}</button>`).join('')}</div><button class="btn sm" data-act="tagclear">Clear</button>` : ''}</div>`;
}
function rowHtml(t, showList) {
  const l = listOf(t.listId), done = t.subtasks.filter(s => s.done).length, fin = t.status !== 'open';
  return `<div class="task${fin ? ' fin' : ''}${U.sel === t.id ? ' sel' : ''}${U.bsel && U.bsel.has(t.id) ? ' picked' : ''}${editedCls(t.id)}" data-act="open" data-id="${t.id}"${U.page === 'matrix' ? ' tabindex="0" role="button"' : canDrag() ? ' draggable="true"' : ''}>
<button class="chk p${t.priority}${t.status === 'done' ? ' on' : ''}" data-act="toggle" data-id="${t.id}" aria-label="Complete task">${t.status === 'done' ? ic('check', 13) : t.status === 'wontdo' ? ic('slash', 13) : ''}</button>
<div class="tb"><div class="ttl">${taskIcon(t)}${titleHtml(t)}</div><div class="meta">${t.due ? `<span class="due${isOverdue(t) ? ' late' : ''}">${esc(dueLabel(t))}</span>` : ''}${t.repeat ? ic('repeat', 12) : ''}${metaX(t)}${t.reminder != null ? ic('bell', 12) : ''}${noteBadge(t)}${t.subtasks.length ? `<span>${ic('list', 12)} ${done}/${t.subtasks.length}</span>` : ''}${t.tags.map(tagChip).join('')}</div></div>
${showList ? `<span class="ln" title="${esc(listLabel(l.id))}"><i style="background:${l.color}"></i>${esc(l.name)}</span>` : ''}</div>`;
}
function cardHtml(t) {
  return `<div class="card p${t.priority}${U.sel === t.id ? ' sel' : ''}${U.bsel && U.bsel.has(t.id) ? ' picked' : ''}${editedCls(t.id)}" draggable="true" data-act="open" data-id="${t.id}"><div class="ttl">${taskIcon(t)}${titleHtml(t)}</div><div class="meta">${t.due ? `<span class="due${isOverdue(t) ? ' late' : ''}">${esc(dueLabel(t))}</span>` : ''}${noteBadge(t)}${t.tags.map(tagChip).join('')}</div></div>`;
}
/* ---------- lists and sublists as folding sections ----------
   In a project, each linked list is a section; in a list that has sublists, the list's own tasks come first and each sublist
   is a section under it, nested as deep as the lists are. A section folds with its header (the choice is kept per view). */
const secKey = (eff, id) => `g:${eff}:${id}`;
function treeSections(open, eff, roots, rootIsList) {
  const by = new Map(); for (const t of sortTasks(open)) { const k = listOf(t.listId).id; if (!by.has(k)) by.set(k, []); by.get(k).push(t); }
  const kids = id => S.lists.filter(x => x.parent === id && x.id !== id);
  const seen = new Set(), total = id => { if (seen.has(id)) return 0; seen.add(id); const n = (by.get(id) || []).length + kids(id).reduce((a, k) => a + total(k.id), 0); seen.delete(id); return n; };
  const rows = id => (by.get(id) || []).map(t => rowHtml(t, false)).join('');
  const used = new Set();
  const sec = (id, depth) => {
    if (used.has(id)) return ''; used.add(id);
    const n = total(id); if (!n) return '';
    const l = listOf(id), k = secKey(eff, id), shut = folded(k);
    const inner = rows(id) + kids(id).map(c => sec(c.id, depth + 1)).join('');
    return `<button type="button" class="grp gtog${shut ? ' closed' : ''}" data-act="gfold" data-k="${esc(k)}" aria-expanded="${!shut}" style="--d:${depth}"><span class="gcar">${ic('chevron-right', 13)}</span><span class="gic" style="color:${l.color}">${listIcon(l, 14)}</span><span class="gnm">${esc(l.name)}</span><span>${n}</span></button><div class="gbody${shut ? ' closed' : ''}"><div class="gin">${inner}</div></div>`;
  };
  let out = '';
  for (const id of roots) {
    if (rootIsList) { used.add(id); out += rows(id) + kids(id).map(c => sec(c.id, 0)).join(''); }
    else { const skip = (() => { let p = (S.lists.find(x => x.id === id) || {}).parent; const g = new Set(); while (p && !g.has(p)) { if (roots.includes(p)) return true; g.add(p); p = (S.lists.find(x => x.id === p) || {}).parent; } return false; })(); if (!skip) out += sec(id, 0); }
  }
  return out;
}
function renderKanban(list, open) {
  const sec = t => (list.sections.includes(t.section) ? t.section : '');
  const cols = [{ id: '', name: 'Not Sectioned' }, ...list.sections.map(s => ({ id: s, name: s }))];
  return `<div class="kan">${cols.map(c => {
    const ts = sortTasks(open.filter(t => sec(t) === c.id));
    return `<div class="col" data-sec="${esc(c.id)}"><div class="chead"><b>${esc(c.name)}</b><span>${ts.length}</span>${c.id ? `<button class="ib sm" data-act="secdel" data-sec="${esc(c.id)}" title="Delete section">${ic('x', 14)}</button>` : ''}</div><div class="cbody">${ts.map(cardHtml).join('')}</div><input class="kadd" data-sec="${esc(c.id)}" placeholder="+ Add task" autocomplete="off"></div>`;
  }).join('')}<button class="col addcol" data-act="secadd">${ic('plus', 16)} Add section</button></div>`;
}
function renderTasks() {
  const draft = U._rn === U.nav && $('#add') ? $('#add').value : ''; U._rn = U.nav;
  const eff = U.q ? 'search' : U.nav, isList = eff.startsWith('list:'), list = isList ? listOf(eff.slice(5)) : null;
  const proj = eff.startsWith('project:') ? projectOf(eff.slice(8)) : null, subs = isList && listDescendants(list.id).length > 0;
  const all = tagFiltered(scopeTasks(eff)), flat = FLAT.includes(eff);
  const open = all.filter(t => t.status === 'open'), fin = all.filter(t => t.status !== 'open');
  const kan = isList && list.view === 'kanban';
  let tools = '';
  if (isList || proj) { const sc = isList ? 'list:' + list.id : 'project:' + proj.id, nn = noteScopeCount(sc); tools += `<button class="ib nbtn" data-act="scopenotes" data-scope="${esc(sc)}" title="Notes${nn ? ' (' + nn + ')' : ''} in this ${isList ? 'list' : 'project'}" aria-label="Notes in this ${isList ? 'list' : 'project'}">${ic('notes')}${nn ? `<i class="nbadge">${nn}</i>` : ''}</button>`; }
  if (isList) tools += `<button class="ib${!kan ? ' on' : ''}" data-act="view" data-v="list" title="List view">${ic('list')}</button><button class="ib${kan ? ' on' : ''}" data-act="view" data-v="kanban" title="Board view">${ic('columns')}</button>`;
  if (all.length && !(eff === 'trash')) tools += `<button class="ib${U.bsel ? ' on' : ''}" data-act="bstart" title="Select several tasks to edit them together" aria-label="Select several tasks">${ic('check-square')}</button>`;
  if (!flat && !kan) tools += `<select data-sel="group" title="Group by">${opts([['none', 'No grouping'], ['date', 'Group: date'], ['priority', 'Group: priority'], ['list', 'Group: list'], ['tag', 'Group: tag']], S.settings.group)}</select><select data-sel="sort" title="Sort by">${opts([['manual', 'Sort: manual'], ['due', 'Sort: due date'], ['priority', 'Sort: priority'], ['title', 'Sort: title'], ['created', 'Sort: created'], ['tags', 'Sort: tags']], S.settings.sort)}</select><button class=\"ib\" data-act=\"sortdir\" title=\"${sortDir() === 'asc' ? 'Ascending' : 'Descending'} — click to reverse\" aria-label=\"Reverse the sort order\">${ic(sortDir() === 'asc' ? 'arrow-up' : 'arrow-down')}</button>`;
  if (isList && list.id !== 'inbox') tools += `<button class="ib" data-act="listmenu" title="List options">${ic('more')}</button>`;
  if (proj) tools += `<button class="btn" data-act="projmenu" data-pid="${esc(proj.id)}">${ic('sliders', 15)} Edit project</button>`;
  if (eff.startsWith('tag:')) tools += `<button class="ib" data-act="tagmenu" data-tag="${esc(eff.slice(4))}" title="Tag colour & name">${ic('more')}</button>`;
  if (eff === 'trash' && all.length) tools += `<button class="btn" data-act="emptytrash">Empty trash</button>`;
  if (eff === 'done' && all.length) tools += `<button class="btn" data-act="cleardone">Clear</button>`;
  let body;
  if (!all.length) body = `<div class="empty">${ic('check-circle', 44)}<p>${eff === 'search' ? 'No matches' : eff === 'trash' ? 'Trash is empty' : 'Nothing here yet'}</p></div>`;
  else if (kan) body = renderKanban(list, open);
  else if (flat) body = all.map(t => rowHtml(t, true)).join('');
  else {
    const g0 = S.settings.group, treeOk = (proj || subs) && (g0 === 'none' || g0 === 'list');
    if (treeOk && open.length) { const roots = proj ? (proj.listIds || []).filter(id => S.lists.some(l => l.id === id)) : [list.id]; body = treeSections(open, eff, roots, !proj); }
    else body = groupTasks(sortTasks(open), proj && S.settings.group === 'none' ? 'list' : undefined).map(g => (g.title ? `<div class="grp">${g.title}<span>${g.tasks.length}</span></div>` : '') + g.tasks.map(t => rowHtml(t, !isList || subs)).join('')).join('');
    if (fin.length) body += `<button class="grp tog" data-act="showdone">${ic(U.showDone[eff] ? 'down' : 'right', 14)} Completed<span>${fin.length}</span></button>` + (U.showDone[eff] ? fin.map(t => rowHtml(t, !isList || subs)).join('') : '');
  }
  if (body && body.includes('gtog')) { tools = `<button class="ib" data-act="gfoldall" title="Fold or unfold every section" aria-label="Fold or unfold every section">${ic('collapse')}</button>` + tools; }
  const pl = proj ? projectListIds(proj) : [], pTarget = proj ? (pl.includes(U.projList[proj.id]) ? U.projList[proj.id] : (proj.listIds || []).find(id => S.lists.some(l => l.id === id))) : null;
  const tgt = isList ? list.name : proj && pTarget ? listLabel(pTarget) : 'Inbox';
  $('#main').innerHTML = (!U.q && isList ? bannerHtml('list', list) : !U.q && proj ? bannerHtml('project', proj) : '') + topHtml(U.q ? `Search “${esc(U.q)}”` : (eff.startsWith('tag:') && tagColor(eff.slice(4)) ? `<span style="color:${tagColor(eff.slice(4))}">${esc(navTitle(eff))}</span>` : esc(navTitle(eff))), tools)
    + (proj ? projHead(proj, all) : '') + tagBar(eff)
    + (proj && !pTarget ? `<div class="quick"><p class="hint">Link at least one list to this project to add tasks here. <button class="btn sm" data-act="projmenu" data-pid="${esc(proj.id)}">Choose lists</button></p></div>` : flat || kan ? '' : `<div class="quick${proj ? ' withsel' : ''}">${proj && pl.length > 1 ? `<select data-sel="projlist" data-pid="${esc(proj.id)}" title="Add new tasks to…">${opts(pl.map(id => [id, listLabel(id)]), pTarget)}</select>` : ''}<input id="add" autocomplete="off" placeholder="+ Add task to “${esc(tgt)}” — try “Pay rent every month !high #bills”"></div>`)
    + `<div class="body${kan ? ' kb' : ''}">${body}</div>`;
  if (draft && $('#add')) $('#add').value = draft;
}

/* ---------- history page ---------- */
const HIST_ICON = { add: 'plus', edit: 'notes', done: 'check-circle', reopen: 'refresh', wontdo: 'slash', delete: 'trash', restore: 'upload', purge: 'x', import: 'download' };
const HIST_KIND_NAME = { task: 'Task', list: 'List', project: 'Project', habit: 'Habit', note: 'Note', slot: 'Slot', app: '' };
const HIST_FIELD = { title: 'Title', due: 'Due date', time: 'Time', dur: 'Duration', priority: 'Priority', tags: 'Tags', listId: 'List', section: 'Section', repeat: 'Repeat', reminder: 'Reminder', notes: 'Notes', subtasks: 'Subtasks', start: 'Plan start', astart: 'Actual start', slotId: 'Timetable slot', name: 'Name', color: 'Colour', icon: 'Icon', goal: 'Goal', sections: 'Sections', view: 'View', days: 'Days', end: 'End', loc: 'Location', body: 'Text', pinned: 'Pin', projectId: 'Project', banner: 'Banner' };
function histVal(k, v) {
  if (v == null || v === '') return 'none';
  if (k === 'due' || k === 'start' || k === 'astart') return fmtDate(v);
  if (k === 'priority') return PRIO[v] || v;
  if (k === 'listId') { const l = S.lists.find(x => x.id === v); return l ? l.name : 'another list'; }
  if (k === 'projectId') { const q = projectOf(v); return q ? q.name : 'another project'; }
  if (k === 'repeat') return repeatLabel(v) || 'none';
  if (k === 'dur') return fmtDur(v);
  if (k === 'reminder') return remLabel(v).toLowerCase();
  if (k === 'goal') return habitGoalLabel(habitGoal({ goal: v }));
  if (k === 'slotId') { const sl = slotById(v); return sl ? sl.title : 'a slot'; }
  if (Array.isArray(v)) return v.join(', ') || 'none';
  return String(v).slice(0, 60);
}
function histDetail(e) {
  if (e.d) return esc(e.d);
  if (!e.f) return '';
  return Object.entries(e.f).map(([k, [a, b]]) => {
    const lab = HIST_FIELD[k] || k;
    if (k === 'notes' || k === 'body') return 'Notes edited'.replace('Notes', lab === 'Text' ? 'Text' : 'Notes');
    if (k === 'subtasks') return 'Subtasks changed';
    if (k === 'pinned') return b ? 'Pinned' : 'Unpinned';
    if (k === 'tags') { const A = a || [], B = b || [], add = B.filter(x => !A.includes(x)), rem = A.filter(x => !B.includes(x)); return 'Tags: ' + [...add.map(x => '+#' + x), ...rem.map(x => '−#' + x)].join(' '); }
    if (k === 'color') return 'Colour changed';
    if (k === 'banner') return 'Banner changed';
    return `${lab}: ${esc(histVal(k, a))} → ${esc(histVal(k, b))}`;
  }).join(' · ');
}
function histFiltered() {
  const h = U.hist, q = h.q.trim().toLowerCase();
  return S.history.filter(e => (!h.kinds.length || h.kinds.includes(e.k)) && (!q || (e.n + ' ' + (e.d || '')).toLowerCase().includes(q)));
}
const histTime = t => { const d = new Date(t), td = todayStr(); return `${pad(d.getHours() % 12 || 12)}:${pad(d.getMinutes())} ${d.getHours() < 12 ? 'AM' : 'PM'}`; };
const histDay = t => { const k = ymd(new Date(t)); return k === todayStr() ? 'Today' : k === ymd(addDays(new Date(), -1)) ? 'Yesterday' : `${FULLDAYS[pYmd(k).getDay()]} ${pYmd(k).getDate()} ${MONTHS[pYmd(k).getMonth()]}${k.slice(0, 4) !== String(new Date().getFullYear()) ? ' ' + k.slice(0, 4) : ''}`; };
function histRow(e) {
  const gone = e.k === 'task' && e.a !== 'purge' && !getT(e.id);
  return `<div class="hrow" data-act="hopen" data-k="${e.k}" data-id="${esc(e.id)}"><span class="hic a-${e.a}">${ic(HIST_ICON[e.a] || 'notes', 16)}</span><div class="hb"><div class="ht"><b class="a-${e.a}">${HIST_ACT[e.a] || e.a}</b>${HIST_KIND_NAME[e.k] ? ` <span class="hk">${HIST_KIND_NAME[e.k]}</span>` : ''} <span class="hnm">${e.k === 'app' ? esc(e.n) : '“' + esc(e.n) + '”'}</span>${gone ? ' <span class="hk">(gone)</span>' : ''}</div>${histDetail(e) ? `<div class="hdt">${histDetail(e)}</div>` : ''}</div><time title="${esc(new Date(e.t).toLocaleString())}">${histTime(e.t)}</time></div>`;
}
function histListHtml() {
  const h = U.hist, base = histFiltered(), list = base.filter(e => !h.acts.length || h.acts.includes(e.a));
  if (!list.length) return `<div class="empty">${ic('history', 44)}<p>${S.history.length ? 'Nothing matches these filters' : 'Nothing logged yet — changes you make will appear here'}</p></div>`;
  const sorted = [...list].sort({ new: (x, y) => y.t - x.t, old: (x, y) => x.t - y.t, action: (x, y) => (HIST_ACT[x.a] || x.a).localeCompare(HIST_ACT[y.a] || y.a) || y.t - x.t, name: (x, y) => x.n.localeCompare(y.n) || y.t - x.t }[h.sort] || ((x, y) => y.t - x.t));
  const shown = sorted.slice(0, h.shown); let out = '', last = null;
  for (const e of shown) {
    const key = h.sort === 'action' ? (HIST_ACT[e.a] || e.a) : h.sort === 'name' ? null : histDay(e.t);
    if (key !== last) { last = key; if (key) out += `<div class="grp">${esc(key)}<span>${h.sort === 'action' ? sorted.filter(x => x.a === e.a).length : ''}</span></div>`; }
    out += histRow(e);
  }
  return out + (sorted.length > shown.length ? `<button class="btn hmore" data-act="hmore">Show ${Math.min(150, sorted.length - shown.length)} more (${sorted.length - shown.length} left)</button>` : '');
}
function renderHistory() {
  const h = U.hist, base = histFiltered(), cnt = a => base.filter(e => e.a === a).length;
  const acts = Object.keys(HIST_ACT).filter(a => S.history.some(e => e.a === a));
  const kinds = ['task', 'list', 'project', 'habit', 'note', 'slot'].filter(k => S.history.some(e => e.k === k));
  $('#main').innerHTML = topHtml('History', `<select data-hsel="sort" title="Order">${opts([['new', 'Newest first'], ['old', 'Oldest first'], ['action', 'By action'], ['name', 'By name']], h.sort)}</select>${S.history.length ? `<button class="btn" data-act="hclear">Clear</button>` : ''}`)
    + `<div class="hfilters"><div class="search hs">${ic('search', 16)}<input id="hq" placeholder="Search the history" autocomplete="off" value="${esc(h.q)}"></div><div class="hchips">${acts.map(a => `<button class="tfc hc a-${a}${h.acts.includes(a) ? ' on' : ''}" data-act="hact" data-a="${a}" aria-pressed="${h.acts.includes(a)}">${HIST_ACT[a]}<small>${cnt(a)}</small></button>`).join('')}${kinds.length > 1 ? '<span class="hsep"></span>' + kinds.map(k => `<button class="tfc${h.kinds.includes(k) ? ' on' : ''}" data-act="hkind" data-k="${k}" aria-pressed="${h.kinds.includes(k)}">${HIST_KIND_NAME[k]}s</button>`).join('') : ''}${h.acts.length || h.kinds.length || h.q ? '<button class="btn sm" data-act="hreset">Reset</button>' : ''}</div></div>`
    + `<div class="body hist" id="hlist">${histListHtml()}</div><p class="hint pad">Kept on this device only (last ${HIST_MAX}). Quick edits to one item are combined.</p>`;
}

/* ---------- calendar ----------
   Views: month, week, day and agenda (the next 30 days as a list). A repeating task is drawn on every date it comes
   round again, not only the next one: those later dates are "virtual" (dashed, not tickable) and open the real task. */
const CAL_VIEWS = [['month', 'Month'], ['week', 'Week'], ['day', 'Day'], ['agenda', 'Agenda']];
const CAL_STEP = { week: 7, day: 1, agenda: 30 };
const calView = () => { const v = (S.settings.cal || {}).view; return CAL_VIEWS.some(x => x[0] === v) ? v : 'month'; };
// the dates (from..to, inclusive) on which an open repeating task comes round again after its own due date
function repeatDates(t, from, to) {
  if (!t.repeat || !t.due || t.status !== 'open' || t.deleted) return [];
  const r = t.repeat, out = []; let cur = t.due;
  if (cur >= to) return out;
  if (cur < from) { // jump close to the window first, so a month far away still shows its repeats
    const gap = dayDiff(from, cur), step = r.unit === 'day' ? r.every : r.unit === 'week' ? (r.days && r.days.length ? 1 : r.every) * 7 : 0;
    if (step > 0) { const n = Math.floor(gap / step) - 1; if (n > 0) cur = ymd(addDays(pYmd(cur), n * (r.unit === 'week' && r.days && r.days.length ? 7 : step))); }
  }
  for (let i = 0; i < 2500; i++) {
    const nx = nextDue({ repeat: r, due: cur });
    if (!(nx > cur) || nx > to) break; // a rule that does not move forward would loop for ever
    cur = nx; if (cur >= from) out.push(cur);
  }
  return out;
}
// every task (and repeat) in a date range, grouped by day: { 'YYYY-MM-DD': [{ t, virt?, d? }] }
function calItems(from, to) {
  const by = {}, add = (k, it) => { (by[k] = by[k] || []).push(it); };
  for (const t of S.tasks) {
    if (t.deleted || t.status === 'wontdo') continue;
    if (t.due && t.due >= from && t.due <= to) add(t.due, { t });
    for (const k of repeatDates(t, from, to)) add(k, { t, virt: true, d: k });
  }
  for (const k of Object.keys(by)) by[k].sort((a, b) => (a.t.time || '').localeCompare(b.t.time || '') || b.t.priority - a.t.priority || (a.virt ? 1 : 0) - (b.virt ? 1 : 0));
  return by;
}
const calDayLabel = k => { const d = pYmd(k), f = fmtDate(k); return ['Today', 'Tomorrow', 'Yesterday'].includes(f) ? `${f} · ${DAYS[d.getDay()]} ${d.getDate()}` : `${FULLDAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 3)}`; };
const calChip = it => {
  const t = it.t, rep = it.virt || t.repeat;
  return `<div class="chip p${t.priority}${t.status !== 'open' ? ' fin' : ''}${it.virt ? ' virt' : ''}${U.sel === t.id ? ' sel' : ''}" data-act="open" data-id="${t.id}"${it.virt ? ` title="Repeats ${esc(repeatLabel(t.repeat).toLowerCase())}: ${esc(fmtDate(it.d))}"` : ''}>${validHM(t.time) ? `<small>${fmtTime(t.time)}</small> ` : ''}${rep && !t.status.startsWith('w') ? ic('repeat', 10) + ' ' : ''}${mdInline(t.title, true)}</div>`;
};
const calRow = (it, showList = true) => {
  if (!it.virt) return rowHtml(it.t, showList);
  const t = it.t;
  return `<div class="task virt" data-act="open" data-id="${t.id}" title="A later repeat of this task"><span class="vic">${ic('repeat', 13)}</span><div class="tb"><div class="ttl">${titleHtml(t)}</div><div class="meta"><span>${esc(repeatLabel(t.repeat))}</span>${t.time ? `<span>${t.time}</span>` : ''}${t.tags.map(tagChip).join('')}</div></div>${showList ? `<span class="ln"><i style="background:${listOf(t.listId).color}"></i>${esc(listOf(t.listId).name)}</span>` : ''}</div>`;
};
function renderCal() {
  const view = calView(), d0 = new Date(U.calD.getFullYear(), U.calD.getMonth(), U.calD.getDate()), ws = +S.settings.weekStart, td = todayStr();
  const wkStart = x => addDays(x, -((x.getDay() - ws + 7) % 7));
  let title, body;
  if (view === 'month') {
    const y = d0.getFullYear(), mo = d0.getMonth(), first = new Date(y, mo, 1), start = wkStart(first);
    const by = calItems(ymd(start), ymd(addDays(start, 41)));
    const head = Array.from({ length: 7 }, (_, i) => `<div class="dow">${DAYS[(ws + i) % 7]}</div>`).join('');
    const cells = Array.from({ length: 42 }, (_, i) => addDays(start, i)).map(d => {
      const k = ymd(d), ts = by[k] || [];
      return `<div class="day${d.getMonth() !== mo ? ' out' : ''}${k === td ? ' today' : ''}" data-act="calday" data-d="${k}"><span class="dn">${d.getDate()}</span>${ts.slice(0, 3).map(calChip).join('')}${ts.length > 3 ? `<div class="more" data-act="calgo" data-d="${k}">+${ts.length - 3} more</div>` : ''}</div>`;
    }).join('');
    title = `${MONTHS[mo]} ${y}`;
    body = `<div class="cal"><div class="dows">${head}</div><div class="cgrid">${cells}</div></div>`;
  } else if (view === 'week') {
    const days = Array.from({ length: 7 }, (_, i) => addDays(wkStart(d0), i)), by = calItems(ymd(days[0]), ymd(days[6]));
    title = ttRange(days);
    body = `<div class="cal-week"><div class="wk-in"><div class="wk-head">${days.map(d => `<button class="wk-dh${ymd(d) === td ? ' today' : ''}" data-act="calgo" data-d="${ymd(d)}" title="Open this day"><small>${DAYS[d.getDay()]}</small><b>${d.getDate()}</b></button>`).join('')}</div><div class="wk-cols">${days.map(d => { const k = ymd(d); return `<div class="wk-col${k === td ? ' today' : ''}" data-act="calday" data-d="${k}">${(by[k] || []).map(calChip).join('')}</div>`; }).join('')}</div></div></div>`;
  } else if (view === 'day') {
    const k = ymd(d0), ts = calItems(k, k)[k] || [];
    title = ttRange([d0]);
    body = `<div class="quick"><input class="caladd" data-d="${k}" autocomplete="off" placeholder="+ Add task on ${esc(fmtDate(k))} — try “Dentist 3pm !high”"></div><div class="body">${ts.length ? ts.map(it => calRow(it)).join('') : `<div class="empty">${ic('calendar', 44)}<p>Nothing planned for ${esc(fmtDate(k).toLowerCase())}</p></div>`}</div>`;
  } else {
    const from = ymd(d0), to = ymd(addDays(d0, 29)), by = calItems(from, to), late = from <= td ? S.tasks.filter(t => !t.deleted && t.status === 'open' && t.due && t.due < td && t.due < to) : [];
    const days = Object.keys(by).sort(), n = days.length + (late.length ? 1 : 0);
    const e0 = addDays(d0, 29), dm = x => `${x.getDate()} ${MONTHS[x.getMonth()].slice(0, 3)}`;
    title = `Agenda · ${dm(d0)} – ${dm(e0)}`;
    body = `<div class="body agenda">${late.length ? `<div class="grp late">Overdue<span>${late.length}</span></div>` + late.sort((a, b) => dueKey(a).localeCompare(dueKey(b))).map(t => rowHtml(t, true)).join('') : ''}${days.map(k => `<div class="grp${k === td ? ' today' : ''}" data-act="calgo" data-d="${k}">${esc(calDayLabel(k))}<span>${by[k].length}</span></div>` + by[k].map(it => calRow(it)).join('')).join('')}${n ? '' : `<div class="empty">${ic('calendar', 44)}<p>Nothing planned in the next 30 days</p></div>`}</div>`;
  }
  const seg = `<div class="seg cal-seg">${CAL_VIEWS.map(([v, n]) => `<button class="${view === v ? 'on' : ''}" data-act="calview" data-v="${v}">${n}</button>`).join('')}</div>`;
  $('#main').innerHTML = topHtml(esc(title), `<button class="ib" data-act="calprev" title="Previous" aria-label="Previous">${ic('left')}</button><button class="btn" data-act="caltoday">Today</button><button class="ib" data-act="calnext" title="Next" aria-label="Next">${ic('right')}</button>${seg}`) + body;
}

/* ---------- eisenhower matrix ----------
   Urgent = due today or overdue, important = medium or high priority. Dragging a task into another box edits those two
   things: priority for important / not important, due date for urgent / not urgent. */
const MQ = [
  { n: 'Urgent & Important', sub: 'Do first', c: 'var(--red)', imp: true, urg: true, add: { priority: 3 } },
  { n: 'Not Urgent & Important', sub: 'Schedule', c: 'var(--p2)', imp: true, urg: false, add: { priority: 3 } },
  { n: 'Urgent & Not Important', sub: 'Delegate', c: 'var(--p1)', imp: false, urg: true, add: {} },
  { n: 'Not Urgent & Not Important', sub: 'Eliminate', c: 'var(--muted)', imp: false, urg: false, add: {} },
];
const mxUrg = t => !!(t.due && t.due <= todayStr()), mxImp = t => t.priority >= 2;
const mxOf = t => MQ.findIndex(q => q.imp === mxImp(t) && q.urg === mxUrg(t));
function mxMove(t, qi) {
  const q = MQ[qi], td = todayStr();
  if (q.imp && !mxImp(t)) t.priority = 3; else if (!q.imp && mxImp(t)) t.priority = 1;
  if (q.urg && !mxUrg(t)) t.due = td;
  else if (!q.urg && mxUrg(t)) { if (t.repeat) t.due = ymd(addDays(new Date(), 1)); else { t.due = null; t.time = null; } }
  if (t.start && t.due && t.start > t.due) t.start = t.due;
}
function renderMatrix() {
  const open = S.tasks.filter(t => !t.deleted && t.status === 'open');
  $('#main').innerHTML = topHtml('Matrix') + `<div class="matrix">${MQ.map((q, i) => {
    const ts = sortTasks(open.filter(t => mxOf(t) === i));
    return `<div class="quad" data-qi="${i}" style="--c:${q.c}"><div class="qh"><b>${q.n}</b><small>${q.sub} · ${ts.length}</small></div><div class="qb">${ts.map(t => rowHtml(t, true)).join('') || '<p class="hint qempty">Drop a task here</p>'}</div><input class="qadd" data-q="${i}" placeholder="+ Add task" autocomplete="off"></div>`;
  }).join('')}</div><p class="hint pad">Drag a task into another box to change it · Urgent = due today or overdue · Important = medium or high priority</p>`;
  U.matrixCtx = MQ.map(q => ({ ...q.add, ...(q.urg ? { due: todayStr() } : {}) }));
}

/* ---------- habits ----------
   A habit has a goal: every day (the default), or N times a week / month. The streak counts consecutive periods
   (days, weeks or months) in which the goal was met; the current period never breaks it until it has ended. */
const HABIT_ICONS = ['💧', '📚', '🏃', '🧘', '💤', '🥗', '✍️', '🎸', '💪', '🚴', '🏊', '🧠', '🍎', '☕', '🚭', '💊', '🦷', '🧹', '🛏️', '📝', '🎨', '🎹', '🎧', '🌱', '🙏', '🚶', '📵', '💰', '📖', '🗣️', '🐕', '☀️', '🌙', '🏋️', '🥤', '🍳', '🧺', '📞', '❤️', '🎯'];
const HABIT_PER = [['day', 'Daily'], ['week', 'Weekly'], ['month', 'Monthly']];
const FIRE_MIN = 2; // the flame shows when a check-in takes the streak to this length or more
function habitGoal(h) {
  const g = h.goal || {}, per = ['day', 'week', 'month'].includes(g.per) ? g.per : 'day', max = per === 'week' ? 7 : per === 'month' ? 31 : 1;
  return { per, n: per === 'day' ? 1 : Math.max(1, Math.min(max, Math.round(+g.n) || 1)) };
}
const habitGoalLabel = g => (g.per === 'day' ? 'Every day' : `${g.n}× a ${g.per}`);
const hStart = (d, per) => (per === 'day' ? new Date(d.getFullYear(), d.getMonth(), d.getDate()) : per === 'week' ? addDays(new Date(d.getFullYear(), d.getMonth(), d.getDate()), -((d.getDay() - +S.settings.weekStart + 7) % 7)) : new Date(d.getFullYear(), d.getMonth(), 1));
const hPrev = (d, per) => (per === 'day' ? addDays(d, -1) : per === 'week' ? addDays(d, -7) : new Date(d.getFullYear(), d.getMonth() - 1, 1));
const hKey = (d, per) => ymd(hStart(d, per));
function habitCounts(h, per) { const c = {}; for (const k of Object.keys(h.log || {})) if (h.log[k]) { const key = hKey(pYmd(k), per); c[key] = (c[key] || 0) + 1; } return c; }
function habitProgress(h) { const g = habitGoal(h); return { ...g, done: habitCounts(h, g.per)[hKey(new Date(), g.per)] || 0 }; }
function streak(h) {
  const { per, n } = habitGoal(h), c = habitCounts(h, per), met = d => (c[hKey(d, per)] || 0) >= n;
  let d = hStart(new Date(), per), s = 0;
  if (!met(d)) d = hPrev(d, per);
  while (met(d) && s < 5000) { s++; d = hPrev(d, per); }
  return s;
}

/* ---------- focus (pomodoro) ---------- */
const fmtClock = s => { s = Math.max(0, Math.ceil(s - 1e-6)); const h = Math.floor(s / 3600); return (h ? h + ':' : '') + `${pad(Math.floor(s % 3600 / 60))}:${pad(s % 60)}`; };
function renderFocus() {
  const C = 2 * Math.PI * 110, td = todayStr();
  const mins = d => S.pomo.filter(p => ymd(new Date(p.ts)) === d).reduce((a, p) => a + p.min, 0);
  const week = Array.from({ length: 7 }, (_, i) => { const d = addDays(new Date(), i - 6); return { d, m: mins(ymd(d)) }; });
  const mx = Math.max(30, ...week.map(x => x.m));
  const openT = S.tasks.filter(t => !t.deleted && t.status === 'open');
  $('#main').innerHTML = topHtml('Focus') + `<div class="body focus">
<div class="modes">${[['focus', 'Focus'], ['short', 'Short break'], ['long', 'Long break']].map(([k, n]) => `<button class="${P.mode === k ? 'on' : ''}" data-act="pmode" data-m="${k}">${n}</button>`).join('')}</div>
<div class="ring"><svg viewBox="0 0 240 240"><circle cx="120" cy="120" r="110" class="bg"/><circle id="pring" cx="120" cy="120" r="110" class="fg" stroke-dasharray="${C}" stroke-dashoffset="${C * (1 - P.left / P.total)}" transform="rotate(-90 120 120)"/></svg><div id="pclock">${fmtClock(P.left)}</div></div>
<div class="padj" role="group" aria-label="Adjust the time">${[[-5, '−5'], [1, '+1'], [5, '+5'], [10, '+10'], [30, '+30']].map(([m, l]) => `<button class="btn sm" data-act="padd" data-m="${m}" title="${m > 0 ? 'Add' : 'Take away'} ${Math.abs(m)} minute${Math.abs(m) === 1 ? '' : 's'}">${l} min</button>`).join('')}</div>
<div class="pctl"><button class="btn pri big" data-act="ptoggle">${P.run ? 'Pause' : P.left < P.total ? 'Resume' : 'Start'}</button><button class="btn big" data-act="preset">Reset</button><button class="btn big" data-act="pskip">Skip</button></div>
<div class="pcus"><input id="pcus" placeholder="Any time: 45, 1h30, 90s, 25:00" autocomplete="off" aria-label="Set any time"><button class="btn" data-act="pcustom">Set time</button></div>
<label class="fdl"><input type="checkbox" data-fd${S.settings.pomo.faceDown ? ' checked' : ''}><span><b>Face-down mode</b><small>For phones: time only counts while the phone lies face down, and pauses when you pick it up. Keeps the screen on while it runs.</small></span></label><div id="pfd" class="pfd"></div>
<select data-sel="ptask"><option value="">No task linked</option>${openT.map(t => `<option value="${t.id}"${P.task === t.id ? ' selected' : ''}>${esc(t.title)}</option>`).join('')}</select>
<div class="stats"><div><b>${mins(td)}</b><small>min today</small></div><div><b>${S.pomo.filter(p => ymd(new Date(p.ts)) === td).length}</b><small>sessions today</small></div><div><b>${Math.round(S.pomo.reduce((a, p) => a + p.min, 0) / 6) / 10}</b><small>hours total</small></div></div>
<div class="bars">${week.map(x => `<div><i style="height:${Math.round(x.m / mx * 100)}%"></i><small>${DAYS[x.d.getDay()]}</small></div>`).join('')}</div></div>`;
  paintClock();
}
function paintClock() {
  const c = $('#pclock'), r = $('#pring');
  if (c) c.textContent = fmtClock(P.left);
  if (r) r.setAttribute('stroke-dashoffset', 2 * Math.PI * 110 * (1 - P.left / P.total));
  const st = fdStatus(), fd = $('#pfd'); if (fd) { fd.className = 'pfd ' + (st ? st[0] : ''); fd.textContent = st ? st[1] : ''; }
  document.title = P.run ? `${fmtClock(P.left)}${S.settings.pomo.faceDown && !pActive() ? ' ⏸' : ''} · OpenTick` : 'OpenTick';
}

/* ---------- task detail ---------- */
function notesHtml(t) {
  const mode = U.nMode || (t.notes.trim() ? 'preview' : 'write');
  const seg = (m, n) => `<button class="${mode === m ? 'on' : ''}" data-act="nmode" data-m="${m}">${n}</button>`;
  return `<div class="notes"><div class="nbar"><div class="seg">${seg('write', 'Write')}${seg('preview', 'Preview')}</div>${mode === 'write' ? mdToolbar('') : ''}<button class="ib sm nx" data-act="nexpand" title="Open the notes in a wider editor" aria-label="Open the notes in a wider editor">${ic('fit', 15)}</button></div>`
    + (mode === 'write'
      ? `<textarea data-f="notes" data-md placeholder="Notes — Markdown supported">${esc(t.notes)}</textarea>`
      : `<div class="nprev md" id="nprev" data-act="nedit" title="Click to edit">${t.notes.trim() ? md(t.notes) : '<span class="hint">Nothing to preview yet</span>'}</div>`) + '</div>';
}
// the notes box of a task grows with its text (never below a comfortable size, never taller than most of the screen)
function fitTa(ta) {
  if (!ta || !ta.style) return; ta.style.height = 'auto';
  const max = Math.round((typeof window !== 'undefined' && window.innerHeight ? window.innerHeight / Z.z : 800) * 0.7), min = narrow(700) ? 220 : 280;
  ta.style.height = Math.min(max, Math.max(min, (ta.scrollHeight || 0) + 4)) + 'px';
}
// Type (task / homework / exam), class, the lesson it belongs to and where an exam is held. Always there for the type; the rest once classes are used.
function classRows(t) {
  const subjects = typeof scOf === 'function' ? scOf('subject') : [], use = subjects.length || t.subjectId || t.lessonId;
  const kindIc = t.kind === 'exam' ? 'exam' : t.kind === 'homework' ? 'homework' : 'graduation';
  let h = `<div class="dr"><span>${ic(kindIc, 16)}</span><select data-f="kind" title="Task, homework or exam">${opts([['', 'Task'], ['homework', 'Homework'], ['exam', 'Exam']], t.kind || '')}</select>${use ? `<select data-f="subject" title="Class">${opts(scSubjOpts(), t.subjectId && scSubj(t.subjectId) ? t.subjectId : '')}</select>` : ''}</div>`;
  if (use) {
    const ch = scLessonChoices(t), cur = t.lessonId && t.due ? t.lessonId + '|' + t.due : '';
    if (cur && !ch.some(c => c[0] === cur) && scGet(t.lessonId)) ch.unshift([cur, 'Tied to a lesson on another day']);
    h += `<div class="dr"><span>${ic('table', 16)}</span><select data-f="lesson" title="The lesson this belongs to: it is drawn inside that lesson on the timetable">${opts([['', 'Not tied to a lesson'], ...ch], cur && ch.some(c => c[0] === cur) ? cur : '')}</select>${t.subjectId && scSubj(t.subjectId) ? `<button class="btn sm" data-act="nextlesson" title="Due at the next lesson of this class">Next lesson</button>` : ''}</div>`;
  }
  if (t.kind === 'exam' || t.room) h += `<div class="dr"><span>${ic('pin', 16)}</span><input data-f="room" value="${esc(t.room || '')}" placeholder="Room or place" autocomplete="off"></div>`;
  return h;
}
function renderDetail() {
  const t = getT(U.sel), el = $('#detail');
  if (U._dsel !== U.sel) { U._dsel = U.sel; U.nMode = null; if (U.sel) fx('#detail > *', 'fade'); } // opening another task starts in the default mode
  document.body.classList.toggle('dopen', !!t);
  if (!t) { el.innerHTML = `<div class="empty">${ic('check-circle', 44)}<p>Select a task to see details</p></div>`; fxFlush(); return; }
  const rk = repeatKey(t.repeat), l = listOf(t.listId), secs = l.sections || [];
  const td = todayStr(), tm = ymd(addDays(new Date(), 1)), nw = ymd(addDays(new Date(), ((8 - new Date().getDay()) % 7) || 7));
  const slots = [...S.slots].sort((a, b) => (a.days[0] || 0) - (b.days[0] || 0) || a.start.localeCompare(b.start));
  const RN = { daily: 'Daily', weekdays: 'Weekdays', weekly: 'Weekly', monthly: 'Monthly', yearly: 'Yearly' };
  el.innerHTML = `
<div class="dhead"><button class="chk p${t.priority}${t.status === 'done' ? ' on' : ''}" data-act="toggle" data-id="${t.id}" aria-label="Complete task">${t.status === 'done' ? ic('check', 13) : ''}</button><input class="dtitle" data-f="title" value="${esc(t.title)}" placeholder="Task title"><button class="ib mob" data-act="closedetail" aria-label="Close">${ic('x', 20)}</button></div>
<div class="dstat"><span class="sv" data-sv aria-live="polite"></span><span id="d-ed">${editedText(t)}</span><span class="dc">Created ${esc(fmtDate(ymd(new Date(t.created || Date.now()))))}</span></div>
<div class="dbody">
<div class="dr"><span>${ic('calendar', 16)}</span><input type="date" data-f="due" value="${t.due || ''}"><input type="time" data-f="time" value="${t.time || ''}"${t.due ? '' : ' disabled'}></div>
<div class="chips"><button class="btn sm${t.due === td ? ' on' : ''}" data-act="qdate" data-w="today">Today</button><button class="btn sm${t.due === tm ? ' on' : ''}" data-act="qdate" data-w="tomorrow">Tomorrow</button><button class="btn sm${t.due === nw ? ' on' : ''}" data-act="qdate" data-w="next">Next week</button><button class="btn sm${!t.due ? ' on' : ''}" data-act="qdate" data-w="none">No date</button></div>
<div class="dr top"><span>${ic('clock', 16)}</span>${durHtml('task', t.dur)}</div>${slots.length ? `<div class="dr"><span>${ic('table', 16)}</span><select data-f="slot" title="Timetable slot">${opts([['', 'No timetable slot'], ...slots.map(x => [x.id, `${x.title} · ${x.days.map(d => DAYS[d]).join('/')} ${fmtTime(x.start)}`])], t.slotId && slotById(t.slotId) ? t.slotId : '')}</select></div>` : ''}
${classRows(t)}<div class="dr"><span>${ic('flag', 16)}</span><div class="pri">${[3, 2, 1, 0].map(p => `<button class="pf p${p}${t.priority === p ? ' on' : ''}" data-act="prio" data-p="${p}">${PRIO[p]}</button>`).join('')}</div></div>
<div class="dr"><span>${ic('list', 16)}</span><select data-f="list">${opts(listOpts(), t.listId)}</select>${secs.length ? `<select data-f="section">${opts([['', 'Not sectioned'], ...secs.map(s => [s, s])], t.section || '')}</select>` : ''}</div>
<div class="dr"><span>${ic('repeat', 16)}</span><select data-f="repeat">${opts([['none', 'Does not repeat'], ...Object.keys(RN).map(k => [k, RN[k]]), ...(rk === 'custom' ? [['custom', repeatLabel(t.repeat)]] : [])], rk)}</select></div>
<div class="dr top"><span>${ic('bell', 16)}</span>${remHtml('task', t.reminder, U.remCustom === t.id)}</div>
<div class="dr"><span>${ic('sparkles', 16)}</span><button class="btn sm ticbtn" data-act="taskicon" title="Give this task an icon">${t.icon ? iconAny(t.icon, 16) + ' Change icon' : 'Add an icon'}</button>${t.icon ? '<button class="btn sm" data-act="taskiconx">Remove</button>' : ''}</div>
<div class="dr"><span>${ic('tag', 16)}</span><input data-f="tags" value="${esc(t.tags.map(g => '#' + g).join(' '))}" placeholder="#tags"></div>
${gtDetailHtml(t)}
${t.tags.length ? `<div class="chips tg">${t.tags.map(g => `<button class="tag tagb"${tagColor(g) ? ` style="--tc:${tagColor(g)}"` : ''} data-act="tagcolor" data-tag="${esc(g)}" title="Colour this tag">#${esc(g)}</button>`).join('')}<small class="hint">tap a tag to colour it</small></div>` : ''}
${notesHtml(t)}
${linkedNotesHtml(t)}
${filesHtml('task', t.id)}
<div class="subs"><h4>Subtasks</h4>${t.subtasks.map(s => `<div class="sub"><button class="chk sm${s.done ? ' on' : ''}" data-act="subtog" data-sid="${s.id}">${s.done ? ic('check', 11) : ''}</button><input data-sf="${s.id}" value="${esc(s.title)}" class="${s.done ? 'fin' : ''}">${s.start || s.due ? `<small class="sd" title="Subtask dates (shown in the Gantt view)">${esc(s.start && s.due ? fmtDate(s.start) + ' – ' + fmtDate(s.due) : fmtDate(s.start || s.due))}</small>` : ''}<button class="ib sm" data-act="subdel" data-sid="${s.id}">${ic('x', 14)}</button></div>`).join('')}<input id="d-subnew" placeholder="+ Add subtask" autocomplete="off"></div>
</div>
<div class="dfoot">${t.deleted ? `<button class="btn" data-act="restore">Restore</button><button class="btn danger" data-act="purge">Delete forever</button>` : `<button class="btn" data-act="wontdo">${t.status === 'wontdo' ? 'Reopen' : "Won't do"}</button><button class="btn" data-act="dup">Duplicate</button><button class="btn danger" data-act="del">Delete</button>`}</div>`;
  fitTa($('#detail textarea[data-f="notes"]'));
  fxFlush();
}

/* ---------- timetable ----------
   Slots (S.slots) repeat every week on their days. Tasks join the grid by date: a task with a time becomes a block
   (its duration, default 30 min), one without a time sits in the all-day row, and a task linked to a slot is listed
   inside that slot's block on its due date.
   Adding: click (or tap) the grid, or drag across it to pick a time range, and a small form asks what to add.
   On a phone the grid shows one day at a time with a week strip on top; swipe sideways to change day. */
let TT_HH = 64; // px per hour; taller on touch screens
const TT_MINH = () => (narrow(600) ? 36 : 34); // the shortest a block is drawn, so a 15-minute task can still be tapped
const coarse = () => !!(typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(pointer:coarse)').matches);
const dragAttr = () => (coarse() ? '' : ' draggable="true"'); // touch screens drag with a long press instead (see main.js)
const ttView = () => U.ttV || (narrow(600) ? 'day' : (S.settings.tt.view || 'week'));
const ttStep = () => ({ day: 1, '3day': 3, week: 7 }[ttView()] || 7);
function ttDays() {
  const tt = S.settings.tt, v = ttView(), b = U.ttDate || new Date(), base = new Date(b.getFullYear(), b.getMonth(), b.getDate());
  if (v === 'day') return [base];
  if (v === '3day') return [0, 1, 2].map(i => addDays(base, i));
  const ws = +S.settings.weekStart, start = addDays(base, -((base.getDay() - ws + 7) % 7));
  return Array.from({ length: 7 }, (_, i) => addDays(start, i)).filter(d => tt.weekends || (d.getDay() !== 0 && d.getDay() !== 6));
}
// What is on a day: weekly slots, class lessons (unless they are switched off for the planner), and the tasks due that day. A task joins the block
// it belongs to: a slot (task.slotId), a lesson (task.lessonId), or, when it has no time of its own, the lesson of its class that day (task.subjectId).
// Anything that has no block to sit in is drawn on its own (with a time) or listed all day (without one).
function ttItems(d, o = {}) {
  const k = ymd(d), items = [], allday = [], cls = o.classes != null ? o.classes : S.settings.tt.classes !== false, off = typeof scOff === 'function' ? scOff(d) : null;
  for (const s of S.slots) if (s.days.includes(d.getDay())) items.push({ k: 'slot', s, a: toMin(s.start), b: Math.max(toMin(s.end), toMin(s.start) + 15), tasks: [] });
  if (cls && typeof scDayLessons === 'function') for (const { p, l } of scDayLessons(d)) items.push({ k: 'lesson', l, p, s: scSubj(l.subjectId), a: toMin(p.start), b: Math.max(toMin(p.end), toMin(p.start) + 15), tasks: [] });
  for (const t of S.tasks) {
    if (t.deleted || t.status === 'wontdo' || t.due !== k) continue;
    const host = (t.slotId && items.find(o => o.k === 'slot' && o.s.id === t.slotId))
      || (cls && ((t.lessonId && items.find(o => o.k === 'lesson' && o.l.id === t.lessonId)) || (!t.time && t.subjectId && items.find(o => o.k === 'lesson' && o.l.subjectId === t.subjectId))));
    if (host) host.tasks.push(t);
    else if (t.time) { const a = toMin(t.time); items.push({ k: 'task', t, a, b: Math.min(1440, a + (t.dur || 30)) }); }
    else allday.push(t);
  }
  return { items, allday, off };
}
// side-by-side columns for overlapping blocks; marks slots that overlap another slot
function ttLayout(items, minMin = 0) {
  // minMin: the shortest a block is drawn, in minutes. A block drawn taller than its time must still keep its neighbours clear,
  // so for placing side by side it is treated as lasting that long ("eb"); `clash` (two slots really overlapping) uses the real times
  for (const i of items) i.eb = Math.max(i.b, i.a + minMin);
  items.sort((x, y) => x.a - y.a || y.eb - x.eb);
  let cluster = [], end = 0;
  const flush = () => { const n = Math.max(1, ...cluster.map(i => i.col + 1)); cluster.forEach(i => { i.n = n; }); cluster = []; };
  for (const it of items) {
    if (cluster.length && it.a >= end) { flush(); end = 0; }
    const used = cluster.filter(c => c.eb > it.a).map(c => c.col);
    let col = 0; while (used.includes(col)) col++;
    it.col = col; cluster.push(it); end = Math.max(end, it.eb);
  }
  flush();
  const sl = items.filter(i => i.k === 'slot' || i.k === 'lesson');
  sl.forEach(i => { i.clash = sl.some(o => o !== i && i.a < o.b && o.a < i.b); });
}
// px per hour so that the shown hours fill the space the grid has (never so tight a label or a block cannot be read)
const TT_HH_MIN = 44, TT_HH_MAX = 92;
const ttFitHH = (avail, spanMin) => Math.max(TT_HH_MIN, Math.min(TT_HH_MAX, Math.floor(avail / (spanMin / 60))));
// the hours worth showing: with "hide quiet hours" on, 6:00–22:00 plus anything scheduled on the days in view
const TT_AUTO = [6, 22];
function ttRange(days) {
  const a = days[0], b = days[days.length - 1];
  if (days.length === 1) return `${FULLDAYS[a.getDay()]} ${a.getDate()} ${MONTHS[a.getMonth()]} ${a.getFullYear()}`;
  return a.getMonth() === b.getMonth() ? `${a.getDate()} – ${b.getDate()} ${MONTHS[b.getMonth()]} ${b.getFullYear()}` : `${a.getDate()} ${MONTHS[a.getMonth()].slice(0, 3)} – ${b.getDate()} ${MONTHS[b.getMonth()].slice(0, 3)} ${b.getFullYear()}`;
}
// the room the tray needs: on by default only when the window is wide enough to keep the grid readable
const ttTrayOn = () => { if (narrow(820)) return false; const u = S.settings.ui; return U.ttTray == null ? zvw() - (u.side ? u.sideW : 0) - (u.detail ? u.detailW : 0) >= 900 : U.ttTray; };
const ttUnscheduled = () => S.tasks.filter(t => !t.deleted && t.status === 'open' && !t.time).sort((a, b) => dueKey(a).localeCompare(dueKey(b)) || b.priority - a.priority);
const ttTrayItem = t => `<div class="tri p${t.priority}${U.sel === t.id ? ' sel' : ''}"${dragAttr()} data-act="open" data-id="${t.id}"><div class="tri-b"><div class="ttl">${titleHtml(t)}</div><div class="meta">${t.due ? `<span class="due${isOverdue(t) ? ' late' : ''}">${esc(dueLabel(t))}</span>` : ''}${metaX(t)}</div></div><button class="ib sm" data-act="ttsched" data-id="${t.id}" title="Pick a day and time" aria-label="Schedule on the timetable">${ic('clock', 15)}</button></div>`;
// a week strip for day / 3-day views: tap a day to jump to it (dots show how busy it is)
function ttStrip(base) {
  const ws = +S.settings.weekStart, start = addDays(base, -((base.getDay() - ws + 7) % 7)), td = todayStr(), sel = ymd(base), span = ttView() === '3day' ? [sel, ymd(addDays(base, 1)), ymd(addDays(base, 2))] : [sel];
  return `<div class="tt-strip">${Array.from({ length: 7 }, (_, i) => addDays(start, i)).map(d => {
    const k = ymd(d), r = ttItems(d), n = r.items.length + r.allday.length;
    return `<button class="${span.includes(k) ? 'on' : ''}${k === td ? ' today' : ''}" data-act="ttjump" data-d="${k}"><small>${DAYS[d.getDay()]}</small><b>${d.getDate()}</b><i>${n ? '•'.repeat(Math.min(3, n)) : ''}</i></button>`;
  }).join('')}</div>`;
}
function renderTimetablePlan() {
  const tt = S.settings.tt, view = ttView(), days = ttDays(), td = todayStr(), phone = narrow(600);
  const data = days.map(d => ({ d, k: ymd(d), ...ttItems(d) }));
  let from = (tt.auto ? TT_AUTO[0] : tt.from) * 60, to = (tt.auto ? TT_AUTO[1] : tt.to) * 60, firstA = 1440;
  for (const x of data) for (const it of x.items) { from = Math.min(from, Math.floor(it.a / 60) * 60); to = Math.max(to, Math.ceil(it.b / 60) * 60); firstA = Math.min(firstA, it.a); }
  const now = new Date(), nowM = now.getHours() * 60 + now.getMinutes(), showsToday = data.some(x => x.k === td);
  if (tt.auto && showsToday) { from = Math.min(from, Math.floor(nowM / 60) * 60); to = Math.max(to, Math.ceil((nowM + 1) / 60) * 60); }
  from = Math.max(0, from); to = Math.min(1440, Math.max(to, from + 60));
  const prevHH = TT_HH;
  TT_HH = tt.fit !== false && U.ttAvail ? ttFitHH(U.ttAvail, to - from) : (phone ? 72 : 64);
  const ppm = TT_HH / 60;
  data.forEach(x => ttLayout(x.items, TT_MINH() / ppm));
  const pos = it => `top:${(it.a - from) * ppm}px;height:${Math.max(TT_MINH(), (it.b - it.a) * ppm - 2)}px;left:calc(${(it.col / it.n) * 100}% + 1px);width:calc(${100 / it.n}% - 3px)`;
  const taskLine = t => `<div class="bl${t.status !== 'open' ? ' fin' : ''}" data-act="open" data-id="${t.id}"><button class="chk sm p${t.priority}${t.status === 'done' ? ' on' : ''}" data-act="toggle" data-id="${t.id}" aria-label="Complete task">${t.status === 'done' ? ic('check', 11) : ''}</button><span>${titleHtml(t)}</span></div>`;
  // a class lesson: drawn at its lesson time (start and end), not draggable (its times belong to Lesson times); its text wraps instead of sliding
  const lessonBlock = (it, d) => {
    const s = it.s, nm = s ? s.name : 'Lesson', room = scRoom(it.l, s), te = scTeacherOf(it.l, s), rng = fmtRange(it.a, it.b);
    return `<div class="blk lsn${it.clash ? ' clash' : ''}" style="${pos(it)};--c:${scColor(s)}" data-act="sclesson" data-lid="${it.l.id}" data-date="${ymd(d)}" data-a="${it.a}" data-b="${it.b}" title="${esc(nm)} ${rng}${room ? ' · ' + esc(room) : ''}${it.clash ? ' (overlaps another block)' : ''}" tabindex="0" role="button" aria-label="${esc(nm)}, ${rng}${room ? ', ' + esc(room) : ''}${te ? ', ' + esc(te.name) : ''}">`
      + `<div class="bt">${it.clash && it.n === 1 ? ic('alert', 12) + ' ' : ''}${s ? iconAny(s.icon || 'graduation', 13) + ' ' : ic('graduation', 13) + ' '}<span class="tt-t">${esc(nm)}</span><span class="tt-tm">${rng}</span></div>`
      + `<div class="bm">${rng}${room ? ` · ${ic('pin', 11)} ${esc(room)}` : ''}${te ? ` · ${esc(te.name)}` : ''}</div>${it.tasks.map(taskLine).join('')}</div>`;
  };
  const block = (it, d) => it.k === 'lesson' ? lessonBlock(it, d) : it.k === 'slot'
    ? `<div class="blk slot${it.clash ? ' clash' : ''}${editedCls(it.s.id)}" style="${pos(it)};--c:${it.s.color}" data-act="ttslot" data-sid="${it.s.id}" data-day="${d.getDay()}" data-a="${it.a}" data-b="${it.b}"${dragAttr()} title="${esc(it.s.title)} ${fmtRange(it.a, it.b)}${it.clash ? ' (overlaps another slot)' : ''}" tabindex="0" role="button" aria-label="${esc(it.s.title)}, ${fmtRange(it.a, it.b)}${it.clash ? ', overlaps another slot' : ''}"><div class="bt">${it.clash && it.n === 1 ? ic('alert', 12) + ' ' : ''}<span class="tt-t">${it.s.icon ? iconAny(it.s.icon, 13) + " " : ""}${esc(it.s.title)}</span><span class="tt-tm">${fmtRange(it.a, it.b)}</span></div><div class="bm">${fmtRange(it.a, it.b)} · ${fmtDur(it.b - it.a)}${it.s.loc ? ` · ${ic('pin', 11)} ${esc(it.s.loc)}` : ''}</div>${it.tasks.map(taskLine).join('')}<i class="rz rz-t" data-e="top" data-k="slot" data-id="${it.s.id}"></i><i class="rz" data-k="slot" data-id="${it.s.id}"></i></div>`
    : `<div class="blk tk p${it.t.priority}${it.t.status !== 'open' ? ' fin' : ''}${U.sel === it.t.id ? ' sel' : ''}${editedCls(it.t.id)}" style="${pos(it)}" data-act="open" data-id="${it.t.id}" data-a="${it.a}" data-b="${it.b}"${dragAttr()} title="${esc(it.t.title)} ${fmtRange(it.a, it.b)}" tabindex="0" role="button" aria-label="${esc(it.t.title)}, ${fmtRange(it.a, it.b)}"><div class="bt"><button class="chk sm p${it.t.priority}${it.t.status === 'done' ? ' on' : ''}" data-act="toggle" data-id="${it.t.id}" aria-label="Complete task">${it.t.status === 'done' ? ic('check', 11) : ''}</button> <span class="tt-t">${titleHtml(it.t)}</span><span class="tt-tm">${fmtRange(it.a, it.b)}</span></div><div class="bm">${fmtRange(it.a, it.b)} · ${fmtDur(it.b - it.a)}</div><i class="rz rz-t" data-e="top" data-k="task" data-id="${it.t.id}"></i><i class="rz" data-k="task" data-id="${it.t.id}"></i></div>`;
  const head = `<div class="tt-row"><div class="tt-cor"></div>${data.map(x => `<button class="tt-dh${x.k === td ? ' today' : ''}" data-act="ttday" data-d="${x.k}" title="Open this day"><small>${DAYS[x.d.getDay()]}</small><b>${x.d.getDate()}</b></button>`).join('')}</div>`;
  const adOpen = tt.adOpen !== false, adN = data.reduce((n, x) => n + x.allday.length + (x.off ? 1 : 0), 0);
  const allday = `<div class="tt-row tt-adrow${adOpen ? '' : ' closed'}"><div class="tt-cor"><button class="adtog" data-act="ttad" aria-expanded="${adOpen}" title="${adOpen ? 'Hide' : 'Show'} all-day tasks"><span>all day</span>${adN ? `<b>${adN}</b>` : ''}${ic(adOpen ? 'up' : 'down', 12)}</button></div>${data.map(x => `<div class="tt-ad${x.off ? ' hasoff' : ''}" data-d="${x.k}">${x.off ? `<div class="chip offc" title="${esc(scName())}: day off">${ic('sun', 12)}<span class="adt">${esc(x.off.label || 'Day off')}</span></div>` : ''}${x.allday.map(t => `<div class="chip adc p${t.priority}${t.status !== 'open' ? ' fin' : ''}${U.sel === t.id ? ' sel' : ''}${editedCls(t.id)}" data-act="open" data-id="${t.id}"${dragAttr()}><button class="chk sm p${t.priority}${t.status === 'done' ? ' on' : ''}" data-act="toggle" data-id="${t.id}" aria-label="Complete task">${t.status === 'done' ? ic('check', 13) : ''}</button><span class="adt">${titleHtml(t)}</span></div>`).join('')}</div>`).join('')}</div>`;
  const hours = Array.from({ length: (to - from) / 60 }, (_, i) => `<span style="top:${i * TT_HH}px">${fmtHour(from / 60 + i)}</span>`).join('');
  const cols = data.map(x => `<div class="tt-col${x.k === td ? ' today' : ''}${x.off ? ' off' : ''}" data-act="ttcell" data-d="${x.k}" data-from="${from}">${x.items.map(it => block(it, x.d)).join('')}${x.k === td && nowM >= from && nowM <= to ? `<div class="tt-now" style="top:${(nowM - from) * ppm}px"></div>` : ''}</div>`).join('');
  const trayOn = ttTrayOn(), un = ttUnscheduled();
  const tray = trayOn ? `<aside class="tray"><div class="rs rs-l" data-rs="tray" role="separator" aria-orientation="vertical" tabindex="0" title="Drag to resize · double-click to reset"></div><div class="trh"><b>Tasks</b><small>${un.length} without a time</small><button class="ib sm" data-act="tttray" title="Hide this panel">${ic('x', 14)}</button></div><input class="tradd" placeholder="+ New task  (try “Study 4pm for 90min”)" autocomplete="off"><div class="trl">${un.slice(0, 80).map(ttTrayItem).join('') || '<p class="hint">Nothing waiting — nice.</p>'}</div><p class="hint">Drag a task onto the grid, or press the clock to pick a time. Pull a block’s top or bottom edge to resize it.</p></aside>` : '';
  const seg = `<div class="seg">${[['day', 'Day'], ['3day', '3 days'], ['week', 'Week']].map(([v, n]) => `<button class="${view === v ? 'on' : ''}" data-act="ttview" data-v="${v}">${n}</button>`).join('')}</div>`;
  const tools = `<button class="ib" data-act="ttprev" title="Previous">${ic('left')}</button><button class="btn" data-act="tttoday">Today</button><button class="ib" data-act="ttnext" title="Next">${ic('right')}</button>${seg}${ttModeSeg()}<button class="btn pri" data-act="ttadd" title="Add a task or a weekly slot">${ic('plus', 16)}<span class="hide-m"> Add</span></button><button class="ib${trayOn ? ' on' : ''}" data-act="tttray" title="Unscheduled tasks">${ic('list')}</button><button class="ib" data-act="ttset" title="Timetable settings">${ic('sliders')}</button>`;
  const old = $('.tt-scroll'), keep = old && !U.ttRe ? old.scrollTop * (TT_HH / (prevHH || TT_HH)) : null;
  const draft = $('.tradd') ? $('.tradd').value : '';
  const hint = S.slots.length ? '' : `<p class="hint pad">${phone ? 'Tap' : 'Click, or drag across'} the grid to add a task or a weekly slot (a class, shift or routine). Tasks with a time appear here too.</p>`;
  const legend = phone ? '' : `<div class="tt-legend"><span><i class="lg slot"></i>Weekly slot</span><span><i class="lg task"></i>Task with a time</span>${S.settings.tt.classes !== false && scHas() ? `<span><i class="lg lsn"></i>${esc(scName())} lesson</span>` : ''}<span class="hint">Click or drag on the grid to add · drag a block to move it · pull its top or bottom edge to resize</span></div>`;
  const strip = view === 'week' ? '' : ttStrip(days[0]);
  $('#main').innerHTML = topHtml(esc(ttRange(days)), tools) + strip + hint + legend
    + `<div class="tt"><div class="tt-scroll"><div class="tt-inner" style="--n:${data.length};--cw:${view === 'week' ? (phone ? 92 : 104) : 0}px;--hh:${TT_HH}px"><div class="tt-top">${view === 'day' ? '' : head}${allday}</div><div class="tt-body" style="height:${(to - from) * ppm}px"><div class="tt-gut">${hours}</div>${cols}</div></div></div>${tray}</div>`
    + `<button class="fab" data-act="ttadd" aria-label="Add to the timetable">${ic('plus', 26)}</button>`;
  const sc = $('.tt-scroll');
  if (sc) sc.scrollTop = keep != null ? keep : Math.max(0, ((showsToday ? nowM - 60 : (firstA < 1440 ? firstA : 8 * 60) - 30) - from) * ppm);
  if (draft && $('.tradd')) $('.tradd').value = draft;
  // measure what the grid really has (headers, strip and the all-day row differ by screen) and fit the hours to it, once
  if (tt.fit !== false && !U.ttRe && sc && sc.clientHeight > 0) {
    const top = $('.tt-top'), av = sc.clientHeight - (top ? top.offsetHeight : 0) - 4, want = ttFitHH(av, to - from);
    U.ttAvail = av;
    if (Math.abs(want - TT_HH) >= 2) { U.ttRe = true; try { renderTimetablePlan(); } finally { U.ttRe = false; } }
  }
}
