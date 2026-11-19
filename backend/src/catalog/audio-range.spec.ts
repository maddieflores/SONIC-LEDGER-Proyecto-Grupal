import { describe, it, expect } from 'vitest';
import { audioRange } from './audio-range.js';
describe('CU08 HTTP Range', () => {
  it('admite archivo completo, rango cerrado, abierto, sufijo y límite final', () => {
    expect(audioRange(undefined, 100)).toBeNull();
    expect(audioRange('bytes=0-9', 100)).toEqual({ start: 0, end: 9 });
    expect(audioRange('bytes=20-', 100)).toEqual({ start: 20, end: 99 });
    expect(audioRange('bytes=-10', 100)).toEqual({ start: 90, end: 99 });
    expect(audioRange('bytes=90-200', 100)).toEqual({ start: 90, end: 99 });
    expect(audioRange('bytes=-200', 100)).toEqual({ start: 0, end: 99 });
  });
  it('rechaza rangos inválidos, múltiples, fuera del archivo o desbordados', () => {
    for (const value of [
      'bytes=100-',
      'bytes=10-1',
      'bytes=-0',
      'bytes=-',
      'bytes=0-1,4-5',
      'items=0-1',
      'bytes=999999999999999999999-',
    ])
      expect(audioRange(value, 100)).toBe(false);
  });
});
