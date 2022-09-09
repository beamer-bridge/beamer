import { UAParser } from 'ua-parser-js';

export const isMobile = (userAgent: string): boolean => {
  const parser = new UAParser(userAgent);
  const { type } = parser.getDevice();
  return type === 'mobile';
};
