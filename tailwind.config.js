module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: '#6a41f1',
        secondary: '#23253a',
        accent: '#faaf48',
        danger: '#ff214f',
        text: '#f2f2f7',
        muted: '#b5b7c6',
        card: '#23233c',
      },
      backgroundImage: {
        'gradient-main': 'linear-gradient(120deg, #23233c 0%, #36336c 54%, #7666d7 100%)',
        'gradient-btn': 'linear-gradient(90deg, #6a00ff 65%, #9147ff 100%)',
      },
      animation: {
        'body-gradient-move': 'body-gradient-move 34s ease-in-out infinite',
        'logo-pulse': 'logo-pulse 2.6s cubic-bezier(0.7,0,0.2,1) infinite',
        'fadeInMenu': 'fadeInMenu 0.2s',
      },
    },
  },
  plugins: [require('autoprefixer')],
}