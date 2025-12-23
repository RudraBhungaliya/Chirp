export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx}",
  ],
  theme: {
    extend: {
      colors: {
        /* WhatsApp */
        primary: "#25D366",
        primaryDark: "#1DA851",

        /* Facebook / Messenger greys */
        chatBg: "#E4E6EB",
        bubbleIn: "#FFFFFF",

        borderMuted: "#DADDE1",
        textMuted: "#65676B",

        /* REQUIRED because your JSX uses these */
        muted: "#E4E6EB",
        background: "#F0F2F5",
      },
    },
  },
  plugins: [],
};
