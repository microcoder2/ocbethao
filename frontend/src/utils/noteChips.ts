export type NoteChipGroup = {
  key: string;
  exclusive: boolean;
  chips: string[];
};

export type ParsedNoteChip = {
  text: string;
  tone: string;
};

export const NOTE_CHIP_GROUPS: NoteChipGroup[] = [
  {
    key: "spicy",
    exclusive: true,
    chips: ["không cay", "cay ít", "cay vừa", "cay nhiều"],
  },
  { key: "veggies", exclusive: true, chips: ["không đậu", "không hành"] },
  { key: "sugar", exclusive: true, chips: ["không đường", "ít đường"] },
  { key: "salt", exclusive: false, chips: ["ít muối"] },
];

export const NOTE_CHIPS = NOTE_CHIP_GROUPS.flatMap((g) => g.chips);

export function splitNoteChips(note?: string | null): string[] {
  return String(note || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function getNoteChipTone(chip: string): string {
  const group = NOTE_CHIP_GROUPS.find((entry) => entry.chips.includes(chip));
  return group?.key || "custom";
}

export function parseNoteChips(note?: string | null): ParsedNoteChip[] {
  return splitNoteChips(note).map((chip) => ({
    text: chip,
    tone: getNoteChipTone(chip),
  }));
}

export function isNoteChipActive(note: string, chip: string): boolean {
  return splitNoteChips(note).includes(chip);
}

export function toggleNoteChip(note: string, chip: string): string {
  const parts = splitNoteChips(note);
  const idx = parts.indexOf(chip);

  if (idx >= 0) {
    // Toggle off
    parts.splice(idx, 1);
  } else {
    // Find the group and remove any exclusive siblings first
    const group = NOTE_CHIP_GROUPS.find((g) => g.chips.includes(chip));
    if (group?.exclusive) {
      const filtered = parts.filter((p) => !group.chips.includes(p));
      filtered.push(chip);
      return filtered.join(", ");
    }
    parts.push(chip);
  }

  return parts.join(", ");
}
