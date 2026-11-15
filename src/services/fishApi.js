// =============================================================
// fishApi.js  (Week 4 - Interoperability)
// =============================================================
// Gets puzzles from Marc Conrad's Fish API (the address from the module):
//   GET https://www.marcconrad.com/uob/fish/api.php?out=json&base64=yes
//
//   out=json    -> the answer comes back as JSON
//   base64=yes  -> the picture is inside the JSON as base64 text
//
// Example answer from the API:
//   { "question": "iVBORw0KGgoAAAANSUhEUg...", "fish": 7, "chest": 2 }
//
//   question = the puzzle picture: a PNG image written as base64 text
//   fish     = the correct answer (treasure chests do not count)
//
// Base64 is a way of writing binary data (like an image) using only
// normal letters and numbers, so it can travel inside JSON text.
// We put "data:image/png;base64," in front of it, which makes a
// "data URL" that an <img> tag can show directly.
//
// How can a web page call another website's API? (CORS)
// Browsers normally block a page from reading answers from a different
// website. The Fish API sends the header "Access-Control-Allow-Origin: *",
// which tells the browser that ANY website may use it, so the game can
// call the HTTPS address directly.
//
// Backup: if the direct call fails (e.g. a network blocks it), the game
// tries '/fish-api/api.php' on its OWN server, which passes the request on
// to the real API (a "proxy", see vite.config.js and server/server.js).
//
// This is the only file in the game that talks to the outside world.
// =============================================================

// EASY CHANGE: the addresses to try, in order (first the real API, then our proxy)
const API_URLS = [
  'https://www.marcconrad.com/uob/fish/api.php?out=json&base64=yes',
  '/fish-api/api.php?out=json&base64=yes',
];
const TIMEOUT_MS = 8000; // EASY CHANGE: give up after 8 seconds (8000 milliseconds)

// Reads the text sent by the API and returns { image, fish }.
// Throws an error if the text is not in the expected format.
export function parseFishResponse(text) {
  // 1. The text should be JSON
  let data;
  try {
    data = JSON.parse(text);
  } catch (error) {
    throw new Error('The Fish API did not send JSON.');
  }

  // 2. "fish" should be a whole number, 0 or more
  //    (Number() also accepts it if the API sends it as text, e.g. "7")
  const fish = Number(data.fish);
  if (!Number.isInteger(fish) || fish < 0) {
    throw new Error('The Fish API reply has no fish count.');
  }

  // 3. "question" should be base64 text (letters, numbers, + and /, maybe = at the end)
  let base64 = String(data.question || '');
  base64 = base64.replace(/\s/g, ''); // remove any spaces or line breaks
  if (!/^[A-Za-z0-9+/]{32,}=*$/.test(base64)) {
    throw new Error('The Fish API picture is not valid base64.');
  }

  // 4. Turn the base64 into something an <img> can show
  const image = 'data:image/png;base64,' + base64;
  return { image: image, fish: fish };
}

// Makes the 4 answer buttons: the correct number and 3 wrong numbers
// close to it (so the player really has to count), in a random order.
export function makeAnswerOptions(correct) {
  // try these differences from the correct answer, in a random order
  const differences = shuffle([1, 2, 3, -1, -2, -3]);

  const wrongAnswers = [];
  for (const difference of differences) {
    const number = correct + difference;
    if (number >= 0 && wrongAnswers.length < 3) {
      wrongAnswers.push(number);
    }
  }

  const options = shuffle([correct, ...wrongAnswers]);
  return { options: options, correctIndex: options.indexOf(correct) };
}

// Puts a list in a random order (Fisher-Yates shuffle).
function shuffle(list) {
  const copy = list.slice();
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const temp = copy[i];
    copy[i] = copy[j];
    copy[j] = temp;
  }
  return copy;
}

// Gets one puzzle ready for the game: { image, options, correctIndex }.
// Tries each address in API_URLS until one works.
// fetchFunction is normally the browser's fetch(); the tests pass a fake one.
export async function getFishPuzzle(fetchFunction = fetch) {
  let lastError = null;
  for (const url of API_URLS) {
    try {
      return await getPuzzleFrom(url, fetchFunction);
    } catch (error) {
      lastError = error; // remember the problem and try the next address
    }
  }
  throw lastError; // every address failed
}

// Asks ONE address for a puzzle.
async function getPuzzleFrom(apiUrl, fetchFunction) {
  // An AbortController lets us cancel the request if it takes too long.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    // "&t=..." makes every address different, so the browser never
    // gives us an old saved (cached) puzzle.
    const url = apiUrl + '&t=' + Date.now();
    const response = await fetchFunction(url, { signal: controller.signal });

    if (!response.ok) {
      throw new Error('The Fish API answered with error ' + response.status + '.');
    }

    // Read the body as text (the API sometimes labels it as HTML, not JSON)
    const text = await response.text();
    const result = parseFishResponse(text);
    const answers = makeAnswerOptions(result.fish);

    return { image: result.image, options: answers.options, correctIndex: answers.correctIndex };
  } catch (error) {
    // Turn every kind of failure into a message the player can understand
    if (error.name === 'AbortError') {
      throw new Error('The Fish API did not answer in time.');
    }
    if (error.message.startsWith('The Fish API')) {
      throw error; // already a clear message
    }
    throw new Error('Could not reach the Fish API. Check your internet connection.');
  } finally {
    clearTimeout(timer); // stop the timeout timer either way
  }
}
