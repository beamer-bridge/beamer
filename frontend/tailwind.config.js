/* eslint-env node */
module.exports = {
  content: ['./public/**/*.html', './src/**/*.{vue,js,ts,jsx,tsx}'],
  theme: {
    colors: {
      black: '#001B23',
      white: '#FFFEFE',
      teal: '#00404B',
      'teal-dark': '#005E63',
      mint: '#F7FFFC',
      green: '#64FA7C',
      lime: '#ADFF00',
      'sea-green': {
        DEFAULT: '#05B0AB',
        35: 'rgba(78, 173, 170, 0.35)',
      },
      red: '#FF0420',
      orange: '#F5AC37',
      grey: '#C4C4C4',
      'red-fire': '#EF4C13',
      fire: '#F1612E',
      rosa: '#FFEDEB',
      transparent: 'transparent',
    },
    boxShadow: {
      DEFAULT: '0px 4px 26px rgba(0, 0, 0, 0.25)',
      inner: 'inset 0px 3px 6px 2px rgba(0, 0, 0, 0.15)',
      'inner-bottom': 'inset 0px -3px 6px 2px rgba(0, 0, 0, 0.15)',
      autofill: '0px 3px 6px 30px inset',
    },
    extend: {
      spacing: { 18: '4.5rem', 112: '28rem' },
      maxWidth: { '2xs': '16rem', '3xs': '12rem' },
      borderRadius: {
        lg: '36px',
        xl: '45px',
        50: '50%',
      },
      fontFamily: {
        sans: ['Sora', 'sans-serif'],
      },
    },
  },
  variants: {
    extend: {},
  },
};
