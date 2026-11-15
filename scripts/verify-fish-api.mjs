// ---------------------------------------------------------------
// verify-fish-api.mjs
// Checks that the REAL Fish API still works with the game's code.
//   npm run verify:api
// It downloads one puzzle, reads it with the game's own parseFishResponse(),
// saves the picture to scripts/last-fish-puzzle.png and prints the answer.
// ---------------------------------------------------------------
import { writeFile } from 'node:fs/promises';
import { parseFishResponse, makeAnswerOptions } from '../src/services/fishApi.js';

const url = 'https://www.marcconrad.com/uob/fish/api.php?out=json&base64=yes';
console.log(`GET ${url}`);

try {
  const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
  const text = await response.text();
  console.log(`HTTP ${response.status}, ${text.length} characters`);

  const { image, fish } = parseFishResponse(text);
  const base64 = image.split(',')[1];
  await writeFile(new URL('./last-fish-puzzle.png', import.meta.url), Buffer.from(base64, 'base64'));
  console.log('Picture saved to scripts/last-fish-puzzle.png');

  const { options, correctIndex } = makeAnswerOptions(fish);
  console.log(`Fish: ${fish}. Answer buttons: ${options.join(', ')} (correct = button ${correctIndex + 1})`);
  console.log('OK: the live Fish API works with the game.');
} catch (err) {
  console.error(`FAILED: ${err.message}`);
  process.exitCode = 1;
}
