// Applies the stored theme before the first paint; src/lib/theme.ts owns the choice afterwards.
try {
  var theme = localStorage.getItem("theme");
  if (theme === "light" || theme === "dark") document.documentElement.dataset.theme = theme;
} catch (e) {}
