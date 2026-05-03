@import "tailwindcss";

@theme {
  --font-sans: "Inter", ui-sans-serif, system-ui, sans-serif;
}

@layer base {
  * {
    @apply border-slate-200 dark:border-slate-800;
  }
  
  body {
    @apply bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100;
  }
}

/* Custom Scrollbar */
::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}

::-webkit-scrollbar-track {
  @apply bg-transparent;
}

::-webkit-scrollbar-thumb {
  @apply bg-slate-200 dark:bg-slate-800 rounded-full transition-colors hover:bg-slate-300 dark:hover:bg-slate-700;
}

/* Emoji Picker Customization */
.EmojiPickerReact {
  @apply !border-slate-200 dark:!border-slate-800 !shadow-2xl !rounded-2xl flex-1 !h-[450px] !w-full max-w-[350px] !bg-white dark:!bg-slate-900;
}
