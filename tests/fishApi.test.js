// Tests for services/fishApi.js (no real internet: fetch is faked).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { parseFishResponse, makeAnswerOptions, getFishPuzzle } from '../src/services/fishApi.js';

// A real PNG in the same format the API sends (picture of 7 fish).
const PNG_BASE64 = readFileSync(new URL('./fixtures/test-fish-7.png', import.meta.url)).toString('base64');
const apiText = (fish) => JSON.stringify({ question: PNG_BASE64, fish, chest: 2 });
const fakeFetch = (text, status = 200) => async () => ({ ok: status === 200, status, text: async () => text });

describe('parseFishResponse', () => {
  it('reads the fish count and turns base64 into an image', () => {
    const result = parseFishResponse(apiText(7));
    expect(result.fish).toBe(7);
    expect(result.image).toBe(`data:image/png;base64,${PNG_BASE64}`);
  });

  it('accepts the fish count as text', () => {
    expect(parseFishResponse(JSON.stringify({ question: PNG_BASE64, fish: '4' })).fish).toBe(4);
  });

  it('rejects answers that are not in the expected format', () => {
    expect(() => parseFishResponse('<html>error</html>')).toThrow(/JSON/);
    expect(() => parseFishResponse(JSON.stringify({ question: PNG_BASE64 }))).toThrow(/fish count/);
    expect(() => parseFishResponse(JSON.stringify({ question: 'not base64!', fish: 3 }))).toThrow(/base64/);
  });
});

describe('makeAnswerOptions', () => {
  it('gives 4 different options with the correct one at correctIndex', () => {
    for (const correct of [0, 1, 5, 12]) {
      const { options, correctIndex } = makeAnswerOptions(correct);
      expect(options).toHaveLength(4);
      expect(new Set(options).size).toBe(4);
      expect(options[correctIndex]).toBe(correct);
      expect(options.every((n) => n >= 0)).toBe(true);
    }
  });
});

describe('getFishPuzzle', () => {
  it('returns a puzzle ready for the game', async () => {
    const puzzle = await getFishPuzzle(fakeFetch(apiText(6)));
    expect(puzzle.image.startsWith('data:image/png;base64,')).toBe(true);
    expect(puzzle.options[puzzle.correctIndex]).toBe(6);
  });

  it('asks for JSON with a base64 picture', async () => {
    let calledUrl;
    await getFishPuzzle(async (url) => { calledUrl = url; return fakeFetch(apiText(3))(); });
    expect(calledUrl).toContain('out=json');
    expect(calledUrl).toContain('base64=yes');
  });

  it('calls the real HTTPS address first, and the proxy only if that fails', async () => {
    const called = [];
    const puzzle = await getFishPuzzle(async (url) => {
      called.push(url);
      if (url.startsWith('https://www.marcconrad.com')) throw new TypeError('Failed to fetch'); // direct call blocked
      return fakeFetch(apiText(5))();
    });
    expect(called[0]).toContain('https://www.marcconrad.com/uob/fish/api.php');
    expect(called[1]).toContain('/fish-api/api.php');
    expect(puzzle.options[puzzle.correctIndex]).toBe(5);
  });

  it('gives a clear error when the server fails or is offline', async () => {
    await expect(getFishPuzzle(fakeFetch('', 500))).rejects.toThrow(/error 500/);
    await expect(getFishPuzzle(async () => { throw new TypeError('Failed to fetch'); })).rejects.toThrow(/Could not reach/);
  });
});
