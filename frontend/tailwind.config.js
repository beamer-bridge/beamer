/* eslint-env node */
module.exports = {
  content: ['./public/**/*.html', './src/**/*.{vue,js,ts,jsx,tsx}'],
  theme: {
    colors: {
      light: '#FFFEFE',
      dark: '#00404B',
      grey: '#BFBFBF',
      teal: '#00404B',
      'teal-light': {
        DEFAULT: '#4EADAA',
        35: 'rgba(78, 173, 170, 0.35)',
      },
      'teal-very-light': '#99DEDC',
      'teal-dark': '#001B23',
      green: '#64FA7C',
      'green-lime': '#ADFF00',
      orange: '#F5AC37',
      'orange-dark': '#E55A39',
      'orange-light': '#EEAC96',
      red: '#FF0420',
      transparent: 'transparent',
      black: '#000000',
    },
    boxShadow: {
      DEFAULT: '0px 4px 26px rgba(0, 0, 0, 0.25)',
      inner: 'inset 0px 3px 6px 2px rgba(0, 0, 0, 0.15)',
      'inner-bottom': 'inset 0px -3px 6px 2px rgba(0, 0, 0, 0.15)',
    },
    extend: {
      spacing: { 18: '4.5rem', 112: '28rem' },
      maxWidth: { '2xs': '16rem', '3xs': '12rem' },
      borderRadius: {
        lg: '36px',
        xl: '45px',
        50: '50%',
      },
    },
  },
  variants: {
    extend: {},
  },
};
