/* OpenTick Help: a reference page (Settings -> Help & user guide, or the command palette), written against what the app really does.
   It is a normal page (U.page = 'help') so it scrolls, zooms and themes like the rest, and it prints as a plain black-on-white
   document (see the @media print rules in styles.css). Platform differences are called out where they exist. */
const HELP_URL = 'https://github.com/JebbyCodes/OpenTick';
const helpCanPrint = () => typeof window !== 'undefined' && typeof window.print === 'function' && !isAndroidApp() && !(typeof isIosApp === 'function' && isIosApp());
const kbd = k => `<kbd>${k}</kbd>`;
const HELP = [
  ['start', 'Getting started', `
<p>OpenTick is a private, offline-first planner. Tasks, notes, a weekly timetable, a Gantt chart, an Eisenhower matrix, habits and a focus timer all share one set of data that lives on your device. There is no account and nothing is sent anywhere unless you set up sync.</p>
<ol><li>Add a task in the box at the top of <b>Tasks</b>. Plain text works: <i>“Call mum tomorrow 5pm !high #family”</i> sets the date, time, priority and tag for you.</li>
<li>Tap a task to open its details: notes, subtasks, repeat, reminder, list, tags and attachments.</li>
<li>Look at the same work in other ways with the view buttons: Calendar, Timetable, Gantt, Matrix.</li></ol>
<p>Everything is saved as you type. Settings (the sliders icon, or <b>More</b> on a phone) holds appearance, clock, notifications, backups and sync.</p>`],
  ['nav', 'Navigating the app', `
<p><b>Desktop and tablets:</b> the sidebar lists the smart views (Inbox, Today, Tomorrow, Next 7 Days, All), your lists and projects, and Completed, Won’t Do, Trash and History. The row of view buttons above it switches between Tasks, Notes, Calendar, Timetable, Gantt, Matrix, Habit and Focus.</p>
<p><b>Phones:</b> a bar along the bottom has Tasks, Notes, Calendar, Timetable and <b>More</b> (the rest of the views). The ☰ button at the top opens the sidebar. Narrow windows hide the details panel; opening a task shows it full screen.</p>
<p>Search with the box in the sidebar, or press ${kbd('/')} or ${kbd('Ctrl')}+${kbd('K')}. ${kbd('Ctrl')}+${kbd('Shift')}+${kbd('P')} opens the command palette, which runs most actions by name, including opening this Help.</p>`],
  ['timetable', 'Timetable', `
<p>The timetable shows your weekly <b>slots</b> (repeating blocks such as lessons or shifts) and any <b>task that has a time</b> on one grid. Choose <b>Day</b>, <b>3 days</b> or <b>Week</b> at the top; the arrows and <b>Today</b> move through time.</p>
<ul><li><b>Add:</b> click or drag on an empty part of the grid (or use <b>Add</b>) to make a slot or a timed task. On a phone, tap the round + button.</li>
<li><b>Move:</b> drag a block; it snaps to 15 minutes. <b>Resize:</b> drag its top or bottom edge. On touch screens press and hold a block until it lifts (a short buzz), then drag.</li>
<li><b>Times</b> are written the way the 12 / 24-hour clock setting says (Settings → Clock). Every block shows its start and end; short blocks put the time beside the title, narrow ones put it underneath.</li>
<li><b>All day</b> tasks (a date but no time) sit in the row under the days. Press that row’s label to fold it away and free space; the count stays visible.</li>
<li>The <b>sliders</b> button opens timetable options: hide the quiet hours (6:00–22:00 plus anything scheduled or the current time), choose your own first and last hour, <i>fit the day to the screen</i> so more hours show without scrolling, and show or hide weekends.</li>
<li>Two slots that overlap are drawn side by side and outlined in red so a clash is easy to see.</li>
<li><b>Lessons and exams:</b> classes from the Classes page are drawn in the grid at their times (outlined, with the room and teacher), and exams appear as timed tasks. A task that belongs to a lesson sits inside that lesson’s block. Tap a lesson for its tasks, to add one, or to cancel it for one day; days off hide lessons.</li></ul>`],
  ['classes', 'Classes: lessons, exams and homework', `
<p>The <b>Classes</b> button in the Timetable header (a graduation cap) opens a weekly lessons page: a school week, a university course list, a training rota. Call it what you like in <i>sliders → Name</i> (Classes, Lessons, Courses, Lectures, Schedule…). The grid button takes you back to the planner. <b>Lessons, exams, homework and tasks are all part of the same timetable:</b> the planner draws your lessons beside your slots and timed tasks, and Classes is the same data laid out for studying.</p>
<ul><li><b>Pages:</b> <i>Today</i> (what is on now and next, and how long until it ends), <i>Day</i> (everything on one day as an agenda: lessons, slots, timed tasks and breaks, each with its start and end), <i>Week</i> (the whole grid at a glance), <i>Exams</i>, <i>Homework</i>, <i>Subjects</i>, <i>Teachers</i> and <i>Notes</i>. Nothing needs scrolling sideways, and names wrap instead of scrolling past: on a narrow phone a long name shrinks to its short name (set one under Subjects) so every lesson is readable.</li>
<li><b>Lesson times:</b> start with <i>Use a standard school day</i> or enter your own periods and breaks (<i>sliders → Lesson times</i>). Lessons are placed by these times, and drawn at those times in the planner.</li>
<li><b>Subjects</b> have a colour, an icon, a short name, a usual room and a teacher. Tap an empty cell in the week to put a class there; tap a lesson to see its tasks, change it, cancel it for just that day, or remove it.</li>
<li><b>A / B weeks</b> and <b>days off:</b> in the settings turn on <i>Alternate between week A and week B</i>, and add holidays so lessons are hidden on those days.</li>
<li><b>Exams and homework are ordinary tasks.</b> They live in a list (or sublist or project) you choose, can have subtasks, notes, a reminder and attachments, and show up in Today, the calendar and the matrix. Set a task’s <i>Type</i> to Exam or Homework, and its <i>Class</i> (and, for an exam, the room), in the task’s details, or type it in the quick-add box: <i>“Chapter 4 test /exam @physics friday 9am”</i> or <i>“Exercises 3 to 8 /hw @maths tomorrow”</i>.</li>
<li><b>Tasks on top of a lesson:</b> a task can belong to a lesson. Choose <i>Lesson</i> in its details, or press <i>Next lesson</i> on homework to set the due date and the lesson in one tap. It then sits on that lesson in the planner and shows under it on the Day page.</li>
<li>The <b>Add</b> menu makes a lesson, exam, homework, task, weekly slot or day off from wherever you are. Existing school data from older versions is converted for you: exams and homework become tasks in a list called <i>Classes</i>.</li>
<li>A <b>reminder</b> arrives shortly before each lesson (settings → Remind me). OpenTick cannot silence your phone during lessons; use your system’s Do Not Disturb schedule for that.</li>
<li>It is saved, encrypted (when you turn that on), backed up and synced like everything else. <i>Show lessons on the main timetable</i> in the settings hides them from the planner if you would rather keep it to tasks and slots.</li></ul>`],
  ['notes', 'Notes', `
<p>Notes are Markdown pages that can be filed in a list or project, tagged, pinned, linked to tasks and given attachments. Write with blocks (type <code>/</code> for a menu), as plain Markdown, beside a live preview, or just read the result.</p>
<ul><li><b>On a phone</b> the open note fills the screen. The slim header holds <i>Back</i>, the title, a <i>Details</i> button and the <i>Edit / Source / Preview</i> switch; the formatting tools are one row you can swipe, sitting right above the keyboard, and the footer is just the word count and when it was saved.</li>
<li><b>Details</b> (the sliders button) opens tags, the list or project the note is filed in, linked tasks and attachments, and folds them away again. A small dot on the button says the note has some. Pin and the note’s icon are in the <i>⋯</i> menu.</li>
<li><b>On a desktop</b> those details stay in view above the note; the expand button gives you a distraction-free full screen (${kbd('Esc')} leaves it) and the panel button hides the note list.</li></ul>`],
  ['embed', 'Embedding in notes', `
<p>Notes and task notes can show other things in place.</p>
<ul><li><b>Another note:</b> <code>![[Note title]]</code> on its own line shows that note inside this one. It goes two levels deep at most and a note is never shown inside itself.</li>
<li><b>Players:</b> <code>![caption](https://…)</code> on its own line becomes a player when the link is YouTube, Vimeo, Spotify, a video file (mp4, webm…), an audio file (mp3, m4a…) or a PDF. Any other link stays a normal picture or link. Players are sandboxed and load only from those sites.</li>
<li><b>Your own files:</b> attach an audio or video file and it plays inside the note on this device.</li>
<li>Type <code>/</code> in the block editor and pick <i>Embed</i> or <i>Embed a note</i>, or use the two toolbar buttons in Source and Split mode.</li></ul>`],
  ['widgets', 'Widgets', `
<p><b>Desktop and web:</b> Settings → Widgets opens a small always-on-top window for Tasks, Lists, Projects, Notes, Calendar, Timetable, Matrix, Habit or Focus. They are made of the app’s own pieces, so they match your theme, and ticking a task or habit there updates everything. Tapping something that needs the big window (a task, a note, a list) brings OpenTick forward and opens it. The Focus widget runs its own timer; finished sessions are saved with your data.</p>
<p><b>Android:</b> long-press the home screen → Widgets → OpenTick. There are widgets for tasks, quick add, lists, projects, notes, calendar, timetable, matrix, habits and focus. They use your theme’s colours and refresh when you leave the app; a task or habit ticked on a widget is applied the next time OpenTick opens. The Focus widget counts down by itself while a session runs.</p>`],
  ['home', 'Projects home screen and start screen', `
<p>The <b>Projects</b> page gives an overview: one card per project with its progress, lists and next task, the lists that are in no project, and what needs attention today. <b>Settings → Start screen</b> picks what OpenTick opens on: Projects, Today, any other page, or a particular list or project.</p>
<p>In a project, each list is a <b>foldable section</b>, and in a list with sublists each sublist is one too. Click a header to fold it; the button next to the sort box folds or unfolds all. In the sidebar, the arrow beside a project shows its lists.</p>`],
  ['matrix', 'The matrix', `
<p>The matrix sorts open tasks into four boxes by urgency and importance, derived from each task’s <b>priority</b> and <b>due date</b>: <i>Do first</i> (urgent and important), <i>Schedule</i> (important, not urgent), <i>Delegate</i> (urgent, not important) and <i>Eliminate</i> (neither).</p>
<ul><li><b>Move a task</b> to change its box. Mouse: drag it onto another box (drop between tasks to place it). Touch: press and hold the task for half a second until it lifts, slide to a box and let go; the grid scrolls when your finger nears its edge. Keyboard: Tab to a task and press ${kbd('Alt')}+an arrow key (left / right and up / down on the 2 × 2 grid; up / down on a phone’s single column). ${kbd('Enter')} opens the task.</li>
<li>Moving a task edits its priority and due date to fit the new box, so it also changes in your other views. A move that is cancelled (you lift the finger outside a box) changes nothing.</li>
<li>Each box has its own quick-add field. A task you add there starts in that box.</li></ul>`],
  ['select', 'Selecting several items', `
<p>Use selection to complete, edit or delete many tasks at once. Start it with the <b>check-square button</b> at the top of the list (Tasks and Matrix), or press and hold a task on a phone’s Tasks list. While it is on, taps select and unselect tasks and a toolbar appears at the bottom with <b>All</b>, <b>Complete</b>, <b>Edit</b> (change list, date, priority, tags for all of them) and <b>Delete</b>, together with how many are selected.</p>
<p><b>To leave selection:</b> press the <b>×</b> at the left of the toolbar, or press ${kbd('Esc')}. The toolbar slides away, nothing is changed, and focus returns to the button that started it.</p>`],
  ['attach', 'Attachments', `
<p>Tasks, notes and timetable slots can carry files (up to 40 MB each). Open the item, find <b>Attachments</b> and press <b>Add</b>; on desktop and the web you can also drop files onto the attachments area. Images and PDFs open in a viewer; other files can be saved back out with <b>Save a copy</b>. Files are stored on your device.</p>
<ul><li><b>Android:</b> Add opens the system file picker, so files from Downloads, Drive and other apps all work. OpenTick reads the file through the system rather than from a path, so it works with cloud-backed providers. A cloud file may need to be made available offline first.</li>
<li>A file that is empty, larger than 40 MB, already attached to the same item, unreadable or no longer available is skipped with a message that says which file and what to try. The other files you picked are still added.</li>
<li>Removing an attachment removes it from the item and frees the space.</li></ul>`],
  ['habits', 'Habits', `
<p>Open <b>Habit</b> and press <b>New habit</b> to give it a name, icon, colour and a goal: every day, or a number of times per week or month. Press the round button on a card to check in; the row of days lets you check in on any day instead. Cards show your current streak and, for weekly or monthly goals, a progress bar for that period.</p>
<ul><li><b>Reach any date:</b> the arrows move a week back or forward; the date box opens the calendar so you can jump straight to any day, month or year (including across year ends and leap days); <b>Today</b> comes back. The row of seven days always ends on the date you chose, and the date is shown above the cards.</li>
<li>You can check in on today or any earlier date. Future days can be looked at but not checked in.</li>
<li>Tap a habit’s icon or name to edit it, change its goal or delete it. Deleting keeps nothing of its history.</li></ul>`],
  ['history', 'The habit history graph', `
<p><b>Habit → History</b> shows up to a year of check-ins as a grid, one square per day, weeks in columns, like a contribution calendar. Months run along the top and weekdays down the side.</p>
<ul><li><b>Shade:</b> for each day it is the share of habits that were due and got checked in: none, up to a third, up to two thirds, more than that, or all. A weekly or monthly goal stops counting as due once it is met for that week or month.</li>
<li><b>Striped</b> squares have no data: a day before the habit existed, or one where nothing was due. They are different from a day when something was due and nothing was checked in. <b>Dashed</b> squares are in the future. Nothing is ever added to your records to fill the graph.</li>
<li>Choose <b>one habit</b> or all together; with one habit a day is simply checked in or not. The summary above shows check-ins, days with at least one check-in, and the completion rate for the period shown.</li>
<li>Select a day (click, tap, or move with the arrow keys) to see each habit’s state that day. <b>Open this day</b> takes you to the Check in view at that date. The arrows and year box move to earlier or later years; <b>Latest</b> returns.</li></ul>`],
  ['time', 'Time, dates and display options', `
<p>Times are stored as 24-hour times and shown the way <b>Settings → Clock</b> says: 12-hour (9:00–10:30 AM) or <b>24-hour clock</b> (09:00–10:30). The same choice applies to the timetable, task labels and reminders. The <b>Week starts on</b> setting (Monday, Sunday or Saturday) changes the calendar, the timetable and the habit graph. Dates in the list use your device’s language and time zone, and a task due “today” changes at your local midnight, including across daylight-saving changes.</p>`],
  ['notify', 'Reminders, repeats and the background service', `
<p><b>Reminders.</b> Open a task’s details and use <i>+ Add a reminder</i>: pick a preset, <i>Custom amount…</i> (any number of minutes, hours, days or weeks before) or <i>At an exact date and time…</i>. A task can have as many as you like. Lessons and timetable slots have their own lead time (Classes settings and the slot’s options). Settings → Notifications also has <b>quiet hours</b> (reminders inside them wait until they end) and an optional <b>morning summary</b>.</p>
<p><b>Repeats.</b> Choose a repeat in the task details; <i>Custom…</i> gives every N days, weeks, months or years, or chosen weekdays. <b>Ends</b> can be <i>On a date</i>: the last day it may happen. <b>Changes</b> lets one date differ: <i>A different time on one date…</i> sets another time and length, or skips that date. Quick add understands “every week until 31 Dec”.</p>
<p><b>Background service.</b> Settings → Notifications → <i>Background service</i> keeps reminders and the timetable going when OpenTick is not on screen.</p>
<ul><li><b>Android:</b> reminders use the system alarm clock and are restored after a restart or an update. Allow notifications (Android 13+) and, if Android asks, alarms and reminders. <i>Persistent timetable notification</i> shows the lesson you are in (or the next one) with a countdown; expand it for the whole day. The room is its small icon. Some phone makers stop background apps: if reminders are late, set OpenTick to “Unrestricted” battery use.</li>
<li><b>Desktop:</b> a tray icon shows today’s timetable (the room is its title on macOS, its tooltip elsewhere). <i>Keep running when the window is closed</i> hides OpenTick to the tray; <i>Start when I sign in</i> starts it hidden. Quit from the tray menu. Reminders are shown by the tray part while the window is hidden. (Some Linux desktops have no tray; then closing the window really closes it.)</li>
<li><b>iOS:</b> the next reminders (about 60) are handed to iOS as scheduled notifications; iOS has no background service.</li>
<li><b>Web:</b> a browser cannot wake a closed page. Reminders arrive while OpenTick is open, in the background or installed as an app.</li></ul>
<p>Everything stays on your device. With encryption on, background notifications are generic unless you allow widgets to show a summary.</p>`],
  ['holidays', 'Holidays', `
<p>A holiday is a named, coloured range of dates (half term, a trip). It shows as a band in the Calendar and Timetable, and your class timetable is hidden on those days. Open <b>Holidays</b> from the calendar or timetable toolbar (or the Classes settings) to add, edit or remove them. Holidays sync like everything else.</p>`],
  ['templates', 'Templates', `
<p>The <b>Templates</b> page keeps text you reuse. Put <code>{{name}}</code> where something changes; <code>{{name|fallback}}</code> uses the fallback when left empty, <code>{{note:Title}}</code> inserts another note, and <code>{{today}}</code>, <code>{{tomorrow}}</code>, <code>{{yesterday}}</code>, <code>{{date}}</code>, <code>{{time}}</code>, <code>{{now}}</code>, <code>{{weekday}}</code>, <code>{{month}}</code> and <code>{{year}}</code> fill in themselves.</p>
<ul><li>Set the <b>questions</b> for each variable: text, long text, number, date, choice, yes/no, or <i>another note as the answer</i>.</li>
<li><b>Use</b> a template to answer the questions one by one with a live preview, then <b>Copy</b>, <b>Save as note</b> or <b>Make a task</b>.</li>
<li>Give a template <b>tags</b>, a <b>list</b> and a <b>project</b>: it then also shows in those places.</li>
<li>Templates sync and are encrypted with the rest of your data.</li></ul>`],
  ['appearance', 'Appearance and interface size', `
<p><b>Settings → Appearance</b> has the built-in themes (light and dark) and lets you import your own. <b>Interface size</b> makes everything larger or smaller, from 80% to 150% (100% is the default): text, buttons and spacing scale together and the layout adapts, so a large setting on a small screen switches to the phone layout. Use the slider, the − and + buttons, or <b>Reset</b>. The value is applied when you let go of the slider and is remembered. It is separate from your browser’s zoom and from zooming the Gantt chart. Printing always uses 100%.</p>`],
  ['bg', 'The animated background', `
<p><b>Settings → Appearance → Background effects</b> adds soft shapes that drift slowly behind the app. You can switch it off, choose a <b>style</b> (Accent glow, Aurora, Dusk, Mist), the <b>shapes</b> (organic blobs, soft circles or flowing forms), the <b>strength</b> and the <b>speed</b>, with a live preview. <b>Let it move</b> off gives a still picture.</p>
<p>The effect never takes input, sits behind everything, and is limited per theme so text keeps its contrast. It stays still if your device asks for reduced motion, and pauses while OpenTick is in the background. It starts switched off on the Android app to save battery.</p>`],
  ['input', 'Keyboard, mouse and touch', `
<table><thead><tr><th>Action</th><th>Keyboard</th><th>Mouse</th><th>Touch</th></tr></thead><tbody>
<tr><td>Search</td><td>${kbd('/')} or ${kbd('Ctrl')}+${kbd('K')}</td><td>Click the search box</td><td>Search box</td></tr>
<tr><td>Command palette</td><td>${kbd('Ctrl')}+${kbd('Shift')}+${kbd('P')}</td><td>–</td><td>–</td></tr>
<tr><td>New task</td><td>${kbd('N')}</td><td>Add box</td><td>Add box</td></tr>
<tr><td>Hide / show sidebar, details</td><td>${kbd('[')} and ${kbd(']')}</td><td>Panel buttons</td><td>☰ button</td></tr>
<tr><td>Focus mode</td><td>${kbd('\\')}</td><td>Focus view</td><td>Focus view</td></tr>
<tr><td>All shortcuts</td><td>${kbd('?')}</td><td>–</td><td>–</td></tr>
<tr><td>Select several tasks</td><td>Button, then ${kbd('Esc')} to leave</td><td>Check-square button</td><td>Press and hold, or the button</td></tr>
<tr><td>Move a matrix task</td><td>${kbd('Alt')} + arrows</td><td>Drag</td><td>Press and hold, then drag</td></tr>
<tr><td>Move / resize a timetable block</td><td>${kbd('Tab')} to a block, ${kbd('Enter')} opens it</td><td>Drag; drag an edge</td><td>Press and hold, then drag</td></tr>
<tr><td>Habit history</td><td>Arrow keys move between days; ${kbd('Home')} ${kbd('End')} ${kbd('PgUp')} ${kbd('PgDn')}</td><td>Click a day</td><td>Tap a day</td></tr>
<tr><td>Close a dialog</td><td>${kbd('Esc')}</td><td>Click outside</td><td>Tap outside</td></tr></tbody></table>`],
  ['shortcuts', 'Keyboard shortcuts and right-click menus', `
<p>On computers almost everything has a shortcut, shown as a small key cap next to its button (switch this off in Settings → Keyboard). Press ${kbd('?')} for the full, searchable list. Shortcuts are switched off on phones and tablets.</p>
<p><b>Right-click</b> (or the Menu key, or ${kbd('Shift')}+${kbd('F10')}) a task, list, project, tag, note, template, calendar day or timetable block for the same choices as its ⋯ button. Hold ${kbd('Shift')} while right-clicking to get the browser’s own menu.</p>`],
  ['access', 'Accessibility', `
<p>Settings → <b>Accessibility</b> collects the options in one place: high contrast, bold text, an easier-to-read font, text spacing, underlined links, <i>do not rely on colour</i> (adds marks for priority, overdue and done), greyscale, a larger pointer, larger tap targets, a strong focus outline, text labels on icon buttons, reduced motion, reduced transparency, how long messages stay and a confirmation before deleting. They are saved on this device only. Messages are announced to screen readers, there is a “skip to the content” link, and everything can be done from the keyboard. The interface size (zoom) is in Appearance.</p>
<p>The <b>privacy policy</b> is in Settings → About &amp; privacy.</p>`],
  ['data', 'Your data, backups and sync', `
<p>Data is saved on your device automatically: tasks, notes, slots and habits in the app’s storage, and attachments in the browser’s file database. Clearing the app’s or browser’s data deletes it, so keep a backup.</p>
<ul><li><b>Backups:</b> Settings → Data has <b>Export</b> (a JSON file with everything) and <b>Import</b> (merge into, or replace, what you have). Automatic restore points are kept on the device and can be restored from the same place.</li>
<li><b>Other apps:</b> you can import lists from other task apps.</li>
<li><b>Sync:</b> optional. Choose a provider in Settings → Sync (WebDAV, a Git repository, S3-compatible storage, or a file in a folder you already sync). OpenTick merges changes from several devices; nothing leaves your device unless you set this up.</li>
<li><b>Encryption:</b> optional, in Settings → Encryption. See the next section.</li>
<li><b>Printing:</b> only this Help is formatted for paper. Other pages are not.</li></ul>`],
  ['encryption', 'Encryption and privacy', `
<p>Turn on <b>Settings → Encryption</b> to lock your data with a passphrase. OpenTick encrypts it (AES-256-GCM) <i>before</i> it is stored, backed up or synced, so a cloud provider, a stolen laptop or a copied backup file shows only scrambled bytes. Only you hold the passphrase; it never leaves your device.</p>
<ul><li><b>You choose what is covered:</b> <i>This device</i> (the stored data, attachments, automatic backups and your sync login; OpenTick asks for the passphrase when it opens), <i>Backup files</i> (exports and downloaded backups) and <i>Cloud sync</i> (the file on your server). The cloud icon shows a small padlock while sync encryption is on, and turns red if something needs your attention.</li>
<li><b>Recovery key:</b> turning encryption on makes a recovery key. Keep it somewhere safe: <b>there is no reset</b>, and without the passphrase or the recovery key encrypted data cannot be opened by anyone, including us.</li>
<li><b>Several devices:</b> turn it on once, then on each other device connect to the same sync location and type the passphrase. Changing the passphrase keeps older backups and other devices working.</li>
<li><b>Locking:</b> <i>Lock now</i>, lock automatically after a time away, or <i>Remember me on this device</i> to skip the prompt (the data stays encrypted in its files, but anyone using the unlocked device can read it).</li>
<li><b>Opening an encrypted backup:</b> Import asks for the passphrase (or the recovery key) when a file is encrypted, and offers to merge or replace as usual.</li>
<li><b>Android widgets</b> cannot decrypt anything. They show “Locked”, unless you allow a readable summary of today in the encryption settings.</li>
<li><b>What stays readable:</b> the file names of your backups, when they were made, and how big they are. Sync also protects against a server quietly swapping your encrypted file for an unencrypted one: you are asked before it is accepted.</li></ul>`],
  ['trouble', 'Common problems', `
<dl>
<dt>“OpenTick is not allowed to read …” when adding a file</dt><dd>Choose the file again from the picker (try Downloads or Documents). If it still fails, copy the file to the device’s internal storage and attach that copy.</dd>
<dt>“… could not be opened from its storage provider”</dt><dd>The file is in a cloud drive that has not downloaded it. Open that drive’s app, make the file available offline, then try again.</dd>
<dt>“… is empty”, “… is larger than 40 MB”, “… is already attached”</dt><dd>The file has no content, is over the limit, or is already on that item. Nothing was changed.</dd>
<dt>The selection toolbar is stuck at the bottom</dt><dd>Press ${kbd('Esc')} or the × at its left. If a task is open, close it first.</dd>
<dt>I can’t check a habit in</dt><dd>Future days cannot be checked in. Use the date box or arrows to go to today or earlier.</dd>
<dt>I can’t see all my hours in the timetable</dt><dd>Quiet hours are hidden by default. Open the timetable’s sliders button and turn off “Hide the quiet hours”, or set your own first and last hour. Anything scheduled outside the shown hours pulls its hour in automatically.</dd>
<dt>Times look 24-hour (or 12-hour) and I want the other</dt><dd>Settings → Clock → 24-hour clock.</dd>
<dt>No notifications</dt><dd>Check Settings → Notifications, then the system’s notification permission for OpenTick (Android Settings → Apps → OpenTick → Notifications; a browser’s site settings).</dd>
<dt>The interface is too big or too small</dt><dd>Settings → Appearance → Interface size → Reset puts it back to 100%.</dd>
<dt>The background is distracting or slow</dt><dd>Settings → Appearance → Background effects: switch it off, or untick “Let it move”.</dd>
<dt>Something looks wrong and I want to report it</dt><dd>Settings → About → Copy diagnostics, then open an issue on GitHub and paste it. It contains no tasks, notes or personal data.</dd></dl>`],
  ['about', 'About, source code and credits', `
<p>OpenTick is free software released into the public domain under the Unlicense. Source code, releases and the issue tracker: <a href="${HELP_URL}" data-ext target="_blank" rel="noopener noreferrer">${HELP_URL}</a>. The current version, build details and the open-source licences and credits are in <b>Settings → About OpenTick</b>.</p>
<p data-help-version></p>`],
];
function helpHtml() {
  const toc = HELP.map(([id, t], i) => `<li><a href="#h-${id}" data-act="hgo" data-t="h-${id}">${i + 1}. ${t}</a></li>`).join('');
  const body = HELP.map(([id, t, h], i) => `<section id="h-${id}" class="help-s"><h2 tabindex="-1">${i + 1}. ${t}</h2>${h}</section>`).join('');
  return `<div class="body help" id="help-doc"><nav class="help-toc" aria-label="Contents"><h2>Contents</h2><ol>${toc}</ol></nav>${body}<p class="help-foot">OpenTick ${esc(APP_VERSION)} · ${esc(HELP_URL)}</p></div>`;
}
function renderHelp() {
  const tools = `<button class="btn" data-act="hback">${ic('left', 16)}<span> Back</span></button>${helpCanPrint() ? `<button class="btn pri" data-act="hprint" title="Print this guide">${ic('printer', 16)}<span> Print</span></button>` : ''}`;
  $('#main').innerHTML = topHtml('Help & user guide', tools) + helpHtml();
  const v = $('[data-help-version]'); if (v) v.textContent = `This is OpenTick version ${APP_VERSION}.`;
}
function openHelp(id) {
  if (U.page !== 'help') U.helpFrom = U.page;
  U.page = 'help'; closeModalIfOpen(); render();
  if (id) setTimeout(() => helpGo('h-' + id), 0);
}
const closeModalIfOpen = () => { if (typeof $ === 'function' && $('#modal.on') && typeof closeModal === 'function') closeModal(); };
function helpGo(id) {
  const el = document.getElementById(id); if (!el) return;
  el.scrollIntoView({ behavior: bgReduced() ? 'auto' : 'smooth', block: 'start' }); if (el.querySelector('h2')) el.querySelector('h2').focus({ preventScroll: true });
}
const HELP_ACT = {
  hgo(el) { helpGo(el.dataset.t); },
  hback() { U.page = U.helpFrom && U.helpFrom !== 'help' ? U.helpFrom : 'tasks'; render(); },
  hprint() { try { window.print(); } catch (e) { toast('Printing is not available here. Open OpenTick in a browser to print this guide.'); } },
};
// contents links are plain anchors (so they read well in print) but must not change the address or take focus away: the app scrolls and focuses itself
document.addEventListener('click', e => { const a = e.target && e.target.closest ? e.target.closest('a[data-act="hgo"]') : null; if (a) e.preventDefault(); }, true);
