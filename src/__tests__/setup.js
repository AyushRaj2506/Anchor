import '@testing-library/jest-dom';

if (typeof window !== 'undefined') Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {}, // deprecated
    removeListener: () => {}, // deprecated
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }),
});

if (typeof window !== 'undefined') window.HTMLElement.prototype.scrollIntoView = function() {};
