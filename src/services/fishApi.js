const API_URLS = [
  'https://www.marcconrad.com/uob/fish/api.php?out=json&base64=yes',
  '/fish-api/api.php?out=json&base64=yes',
];
const TIMEOUT_MS = 8000;

export function parseFishResponse(text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch (error) {
    throw new Error('The Fish API did not send JSON.');
  }

  const fish = Number(data.fish);
  if (!Number.isInteger(fish) || fish < 0) {
    throw new Error('The Fish API reply has no fish count.');
  }

  let base64 = String(data.question || '');
  base64 = base64.replace(/\s/g, '');
  if (!/^[A-Za-z0-9+/]{32,}=*$/.test(base64)) {
    throw new Error('The Fish API picture is not valid base64.');
  }

  const image = 'data:image/png;base64,' + base64;
  return { image: image, fish: fish };
}

export function makeAnswerOptions(correct) {
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

export async function getFishPuzzle(fetchFunction = fetch) {
  let lastError = null;
  for (const url of API_URLS) {
    try {
      return await getPuzzleFrom(url, fetchFunction);
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
}

async function getPuzzleFrom(apiUrl, fetchFunction) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const url = apiUrl + '&t=' + Date.now();
    const response = await fetchFunction(url, { signal: controller.signal });

    if (!response.ok) {
      throw new Error('The Fish API answered with error ' + response.status + '.');
    }

    const text = await response.text();
    const result = parseFishResponse(text);
    const answers = makeAnswerOptions(result.fish);

    return { image: result.image, options: answers.options, correctIndex: answers.correctIndex };
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error('The Fish API did not answer in time.');
    }
    if (error.message.startsWith('The Fish API')) {
      throw error;
    }
    throw new Error('Could not reach the Fish API. Check your internet connection.');
  } finally {
    clearTimeout(timer);
  }
}
