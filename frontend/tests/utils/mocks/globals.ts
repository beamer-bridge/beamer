import { vi } from 'vitest';

const localStorage = vi.fn(() => ({
  getItem: vi.fn(),
  setItem: vi.fn(),
}));

vi.stubGlobal('localStorage', localStorage);
