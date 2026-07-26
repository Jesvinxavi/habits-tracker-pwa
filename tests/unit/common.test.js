import { describe, expect, it } from 'vitest';
import { generateUuid } from '../../src/shared/common.js';

describe('UUID generation', () => {
  it('uses randomUUID when the browser provides it', () => {
    expect(generateUuid({ randomUUID: () => 'native-uuid' })).toBe('native-uuid');
  });

  it('generates a valid version-4 UUID without randomUUID', () => {
    const cryptoWithoutRandomUuid = {
      getRandomValues(bytes) {
        bytes.fill(0xab);
        return bytes;
      },
    };
    expect(generateUuid(cryptoWithoutRandomUuid)).toBe(
      'abababab-abab-4bab-abab-abababababab'
    );
  });

  it('still generates an operation ID when Web Crypto is unavailable', () => {
    expect(generateUuid(null)).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
    );
  });
});
