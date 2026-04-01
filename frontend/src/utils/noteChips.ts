export type NoteChipGroup = {
  key: string;
  exclusive: boolean;
  chips: string[];
};

export const NOTE_CHIP_GROUPS: NoteChipGroup[] = [
  { key: "spicy",   exclusive: true,  chips: ["Không cay", "Ít cay", "Cay vừa", "Cay đậm"] },
  { key: "veggies", exclusive: true,  chips: ["Thêm rau", "Không rau"] },
  { key: "sauce",   exclusive: false, chips: ["Ít nước chấm"] },
  { key: "sugar",   exclusive: true,  chips: ["Ít đường", "Không đường"] },
  { key: "salt",    exclusive: false, chips: ["Ít muối/hạt nêm"] },
];

export const NOTE_CHIPS = NOTE_CHIP_GROUPS.flatMap((g) => g.chips);

export function isNoteChipActive(note: string, chip: string): boolean {
  return note.split(",").map((s) => s.trim()).includes(chip);
}

export function toggleNoteChip(note: string, chip: string): string {
  const parts = note.split(",").map((s) => s.trim()).filter(Boolean);
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
