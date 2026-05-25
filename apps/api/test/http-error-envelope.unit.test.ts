import { describe, expect, it } from 'vitest';

function mapStatusToCode(status: number): string {
  switch (status) {
    case 400: return 'VALIDATION_ERROR';
    case 401: return 'UNAUTHORIZED';
    case 403: return 'FORBIDDEN';
    case 404: return 'NOT_FOUND';
    case 409: return 'CONFLICT';
    case 422: return 'UNPROCESSABLE';
    case 429: return 'RATE_LIMITED';
    case 501: return 'NOT_IMPLEMENTED';
    default: return 'ERROR';
  }
}

describe('HTTP error envelope status mapping', () => {
  const cases: [number, string][] = [
    [400, 'VALIDATION_ERROR'],
    [401, 'UNAUTHORIZED'],
    [403, 'FORBIDDEN'],
    [404, 'NOT_FOUND'],
    [409, 'CONFLICT'],
    [422, 'UNPROCESSABLE'],
    [429, 'RATE_LIMITED'],
    [501, 'NOT_IMPLEMENTED'],
    [418, 'ERROR'],
    [500, 'ERROR'],
  ];
  for (const [status, code] of cases) {
    it(`maps ${status} → ${code}`, () => {
      expect(mapStatusToCode(status)).toBe(code);
    });
  }
});
