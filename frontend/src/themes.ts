export interface Theme {
  id: string;
  name: string;
  swatch: string;
}

export const THEMES: Theme[] = [
  { id: "ember",    name: "Ember",    swatch: "#c9572b" },
  { id: "ocean",    name: "Ocean",    swatch: "#1a7ab0" },
  { id: "matcha",   name: "Matcha",   swatch: "#3d7a52" },
  { id: "midnight", name: "Midnight", swatch: "#a78bfa" },
];

const KEY = "obt-theme";

export function applyTheme(id: string): void {
  if (id === "ember") {
    document.documentElement.removeAttribute("data-theme");
  } else {
    document.documentElement.setAttribute("data-theme", id);
  }
  localStorage.setItem(KEY, id);
}

export function initTheme(): string {
  const saved = localStorage.getItem(KEY) ?? "ember";
  applyTheme(saved);
  return saved;
}

export function getCurrentTheme(): string {
  return localStorage.getItem(KEY) ?? "ember";
}
