/* The made-up data the screenshots show. It runs INSIDE the released app (capture.py evaluates it once, saves, and reads back what the app stored), so it is stored exactly
   as the app stores anything. Everything is invented here: names, lists, notes and dates. Dates are relative to the fixed "today" of the capture (Wednesday 18 November 2026).
   Only long-standing app functions are used (S, uid, ymd, addDays, newNote, kbNewBoard, xsFromTemplate, packParse, packInstall); if a release renames one the capture stops
   with the error, on purpose, and this file is where to fix it. */
(args) => {
  const d = n => ymd(addDays(new Date(), n)), now = Date.now(), H = 3600000, D = 86400000;
  const mk = (id, title, o = {}) => ({ id: 'demo-' + id, title, notes: '', listId: 'inbox', due: null, time: null, priority: 0, tags: [], subtasks: [], repeat: null, reminder: null, status: 'open', section: null, created: now - 5 * D, order: 0, ...o });
  const st = (id, title, done) => ({ id: 'demo-s' + id, title, done });
  S.lists = [
    { id: 'inbox', name: 'Inbox', color: '#4772fa', sections: [] },
    { id: 'personal', name: 'Personal', color: '#f4a62a', sections: [] },
    { id: 'work', name: 'Work', color: '#34b36b', sections: [] },
    { id: 'study', name: 'Study', color: '#8e5cf7', sections: [] },
  ];
  S.projects = [{ id: 'demo-site', name: 'Website relaunch', color: '#34b36b', listIds: ['work'], created: now }, { id: 'demo-flat', name: 'Moving flat', color: '#f4a62a', listIds: ['personal'], created: now }];
  const T = [
    mk('report', 'Finish the quarterly report', { due: d(0), time: '11:00', dur: 90, priority: 3, listId: 'work', tags: ['report'], subtasks: [st(1, 'Collect the figures', true), st(2, 'Write the summary', true), st(3, 'Check the charts', false)], notes: 'Send to the team once the charts are checked.' }),
    mk('sam', 'Reply to Sam about the venue', { due: d(0), time: '12:30', dur: 15, priority: 2 }),
    mk('plants', 'Water the plants', { due: d(0), time: '08:00', dur: 15, listId: 'personal', repeat: { every: 3, unit: 'day' }, status: 'done', doneAt: now - 2 * H }),
    mk('dentist', 'Book a dentist appointment', { due: d(0), priority: 2, listId: 'personal' }),
    mk('cards', 'Revise chapter 6 flashcards', { due: d(0), time: '16:00', dur: 45, listId: 'study', tags: ['revision'] }),
    mk('parcel', 'Pick up the parcel', { due: d(0), time: '18:15', dur: 30, priority: 1, listId: 'personal' }),
    mk('insurance', 'Renew the car insurance', { due: d(-1), priority: 3, listId: 'personal', tags: ['bills'] }),
    mk('retro', 'Team retrospective', { due: d(1), time: '15:00', dur: 60, listId: 'work' }),
    mk('essay', 'Outline the history essay', { due: d(2), listId: 'study', tags: ['revision'] }),
    mk('boxes', 'Label the boxes for the move', { due: d(3), listId: 'personal' }),
    mk('g1', 'Design review', { listId: 'work', start: d(-9), due: d(-3), astart: d(-9), status: 'done', doneAt: now - 3 * D }),
    mk('g2', 'Write the new copy', { listId: 'work', start: d(-4), due: d(4), astart: d(-3) }),
    mk('g3', 'Build the landing page', { listId: 'work', start: d(-1), due: d(9), astart: d(-1), priority: 2 }),
    mk('g4', 'Test on phones and tablets', { listId: 'work', start: d(7), due: d(13) }),
    mk('g5', 'Launch', { listId: 'work', start: d(14), due: d(14), priority: 3 }),
    mk('g6', 'Pack the kitchen', { listId: 'personal', start: d(2), due: d(6) }),
  ];
  T.forEach((t, i) => { t.order = i * 1000; });
  S.tasks = T;
  // a board for the work list
  const b = kbNewBoard('Website relaunch', 0, 'list:work'); b.id = 'demo-board'; S.boards = [b]; S.settings.ui.board = b.id; // the "Simple" preset: To do, Doing, Done
  const col = n => b.cols[n].id, place = { report: 1, g1: 2, g2: 1, g3: 1, g4: 0, g5: 0, retro: 0 };
  for (const t of T) if (t.listId === 'work') { t.kb = { [b.id]: col(place[t.id.slice(5)] != null ? place[t.id.slice(5)] : 0) }; }
  // notes
  const note = (id, title, body, tags, o = {}) => newNote({ id: 'demo-n-' + id, title, body, tags, created: now - o.age * D, updated: now - o.age * D, pinned: !!o.pinned });
  S.notes = [
    note('trip', 'Weekend in Lisbon', '# Weekend in Lisbon\n\nA short plan for the trip.\n\n## Friday\n- Arrive, drop the bags, find dinner\n- Walk up to the viewpoint at sunset\n\n## Saturday\n- Morning market\n- Tram 28 (go early, it fills up)\n- **Book** the evening music place\n\n> Pack a light jacket: the evenings are cool.', ['travel'], { age: 1, pinned: true }),
    note('ideas', 'Ideas for the newsletter', '## Ideas\n\n1. A short guide to planning a week\n2. Three habits that stuck\n3. What to do when a plan falls apart\n\n- [x] Pick a title\n- [ ] Write the first draft\n- [ ] Ask Sam to read it', ['writing'], { age: 2 }),
    note('recipe', 'Lentil soup', '## Lentil soup\n\n**Serves 4**\n\n- 1 onion, 2 carrots, 2 cloves of garlic\n- 250 g red lentils\n- 1 litre of stock\n- Lemon, cumin, a little salt\n\nSoften the vegetables, add everything else and simmer for 25 minutes.', ['food'], { age: 6 }),
    note('meeting', 'Retrospective notes', '## What went well\n- The launch checklist\n- Short, daily check-ins\n\n## To improve\n- Hand-overs between teams\n- Fewer meetings on Fridays', ['work'], { age: 4 }),
  ];
  // habits
  const log = (every, off) => { const o = {}; for (let i = 0; i < 40; i++) if ((i + off) % every !== 0 || i < 2) o[d(-i)] = true; return o; };
  const lg = (days) => { const o = {}; for (const i of days) o[d(-i)] = true; return o; };
  S.habits = [
    { id: 'demo-h1', name: 'Read for 20 minutes', icon: '📖', color: '#8e5cf7', goal: { per: 'day', n: 1 }, created: d(-60), log: log(5, 1) },
    { id: 'demo-h2', name: 'Go for a run', icon: '🏃', color: '#34b36b', goal: { per: 'week', n: 3 }, created: d(-60), log: lg([0, 2, 4, 7, 9, 11, 14, 16, 19, 21, 23, 28, 30, 32, 35, 37]) },
    { id: 'demo-h3', name: 'Drink water', icon: '💧', color: '#4772fa', goal: { per: 'day', n: 1 }, created: d(-60), log: log(7, 3) },
    { id: 'demo-h4', name: 'Stretch', icon: '🧘', color: '#f4a62a', goal: { per: 'day', n: 1 }, created: d(-60), log: log(3, 0) },
  ];
  // lessons for the calendar
  const slot = (id, title, days, start, end, color, room) => ({ id: 'demo-sl' + id, title, days, start, end, color, loc: room || '', notes: '', remind: null, created: now });
  S.slots = [slot(1, 'Algorithms lecture', [1, 3], '09:00', '10:30', '#4772fa', 'B12'), slot(2, 'Seminar group', [2], '11:00', '12:00', '#34b36b', 'A4'), slot(3, 'Networks lab', [4], '14:00', '16:00', '#8e5cf7', 'Lab 2'), slot(4, 'Gym', [1, 3, 5], '07:30', '08:15', '#e5484d')];
  // a section made from the built-in "Reading list" starting point, with a few entries
  const rs = xsFromTemplate(XS_TEMPLATES.find(t => t.id === 'reading')); rs.id = 'x-demo-reading'; rs.name = 'Reading list'; S.csections = [rs];
  const f = n => rs.fields.find(x => x.name === n).id;
  const book = (id, title, author, status, rating, notes) => ({ id: 'demo-e-' + id, sid: rs.id, title, notes: notes || '', vals: { [f('Author')]: author, [f('Status')]: status, ...(rating ? { [f('Rating')]: rating } : {}) }, done: false, contactIds: [], created: now - 9 * D });
  S.centries = [
    book('b1', 'The Garden of Small Things', 'Ada Marlowe', 'Reading', 0, 'Slow and lovely so far.'), book('b2', 'A Field Guide to Quiet', 'Noor Bakshi', 'Finished', 5), book('b3', 'The Lantern Maker', 'Tom Whitlock', 'Finished', 4),
    book('b4', 'Maps of the Inner Coast', 'Iris Delgado', 'To read', 0), book('b5', 'Winter Notebook', 'Jonas Kerr', 'To read', 0), book('b6', 'The Long Way Round', 'Mei Anderson', 'Finished', 4),
  ];
  // a pack from the library (a copy of a published one, see demo/study-planner.pack.json), added as the library adds it
  const parsed = packParse(args.pack);
  if (!parsed.pack) throw new Error('the demo pack was not accepted: ' + JSON.stringify(parsed.errors || parsed));
  packInstall(parsed.pack, { kind: 'library', code: 'HN6G-1CE5', sha256: '0'.repeat(64), size: args.pack.length });
  S.settings.cal.view = 'month';
  S.settings.ui.pins = [];
  save();
}
