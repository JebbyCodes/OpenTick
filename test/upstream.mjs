// The upstream-spec reader and drift check used by scripts/sync-opengantt.mjs (no network).
import assert from 'node:assert/strict';
import { extractSpec, drift, SUPPORTED } from '../scripts/sync-opengantt.mjs';

const README = `
Row keys: \`label\`, \`plan\`, \`fact\`, \`children\`, \`notes\`.

| Key ↕▾      | Values ↕▾                       | Default ↕▾        |
| ----------- | ------------------------------- | ----------------- |
| −\`scale\`    | \`day\`, \`week\`, \`month\`, \`year\`   | \`day\`             |
| \`mode\`      | \`plan\`, \`actual\`, \`both\`          | \`both\`            |
| \`height\`    | pixels, 200 to 1600             | \`520\`             |
| \`padding\`   | empty days                      | \`7\`               |
| \`hatch\`     | \`false\` makes bars solid        | \`true\`            |
| \`progress\`  | \`false\` shows striped           | \`true\`            |
| \`collapsed\` | \`true\`                          | \`false\`           |
| \`columns\`   | which columns                   | saved             |
| \`table\`     | \`false\`                         | saved             |
| \`title\`     | heading                         | name              |
| ⚙           |                                 |                   |

Hello.

| Column                      | Shows | \`columns:\` name             |
| --------------------------- | ----- | --------------------------- |
| Progress                    | %     | \`progress\`                  |
| Start planned / End planned | dates | \`planStart\` / \`planEnd\`     |
| Start actual / End actual   | dates | \`actualStart\` / \`actualEnd\` |
| Planned days / Actual days  | days  | \`planDays\` / \`actualDays\`   |
| Variance                    | late  | \`variance\`                  |
| Status                      | state | \`status\`                    |
| Notes                       | notes | \`notes\`                     |
`;

const s = extractSpec(README);
assert.deepEqual(s.rowKeys, ['label', 'plan', 'fact', 'children', 'notes']);
assert.deepEqual(s.scales, ['day', 'week', 'month', 'year']);
assert.deepEqual(s.options, ['scale', 'mode', 'height', 'padding', 'hatch', 'progress', 'collapsed', 'columns', 'table', 'title']);
assert.deepEqual(s.columns, ['progress', 'planStart', 'planEnd', 'actualStart', 'actualEnd', 'planDays', 'actualDays', 'variance', 'status', 'notes']);
assert.deepEqual(drift(s), [], 'the README of the day matches what OpenTick supports');

// something new upstream is reported
const s2 = extractSpec(README.replace('`day`, `week`', '`hour`, `day`, `week`').replace('`label`,', '`label`, `owner`,').replace('| `title`', '| `theme`     | x | y |\n| `title`').replace('| Variance ', '| Baseline | b | `baseline` |\n| Variance '));
assert.deepEqual(drift(s2), ['row key “owner”', 'scale “hour”', 'chart option “theme”', 'table column “baseline”']);
assert.ok(SUPPORTED.rowKeys.includes('label'));
console.log('upstream spec tests passed');
