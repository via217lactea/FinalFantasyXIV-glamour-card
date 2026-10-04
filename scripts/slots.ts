/**
 * The equip categories a glamour card cares about.
 * Rings occupy one category but two UI slots (ring1 / ring2).
 * Waist and SoulCrystal are deliberately excluded — belts were retired in 6.0
 * and soul crystals are never visible.
 */
export const SLOTS = [
  'mainhand',
  'offhand',
  'head',
  'body',
  'hands',
  'legs',
  'feet',
  'earrings',
  'necklace',
  'bracelets',
  'ring',
  // Not from the Item sheet — facewear lives in Glasses, fashion accessories in
  // Ornament. Both are appended so the EquipSlotCategory bit positions above
  // stay put.
  'facewear',
  'ornament',
] as const;

export type Slot = (typeof SLOTS)[number];

/** EquipSlotCategory column name -> our slot id. */
export const ESC_COLUMN_TO_SLOT: Record<string, Slot> = {
  MainHand: 'mainhand',
  OffHand: 'offhand',
  Head: 'head',
  Body: 'body',
  Gloves: 'hands',
  Legs: 'legs',
  Feet: 'feet',
  Ears: 'earrings',
  Neck: 'necklace',
  Wrists: 'bracelets',
  FingerL: 'ring',
  FingerR: 'ring',
};

export const SLOT_BIT: Record<Slot, number> = Object.fromEntries(
  SLOTS.map((s, i) => [s, 1 << i]),
) as Record<Slot, number>;

/** The UI slots rendered on the card, in display order. */
export const UI_SLOTS = [
  { id: 'mainhand', accepts: 'mainhand' },
  { id: 'offhand', accepts: 'offhand' },
  { id: 'head', accepts: 'head' },
  { id: 'body', accepts: 'body' },
  { id: 'hands', accepts: 'hands' },
  { id: 'legs', accepts: 'legs' },
  { id: 'feet', accepts: 'feet' },
  { id: 'earrings', accepts: 'earrings' },
  { id: 'necklace', accepts: 'necklace' },
  { id: 'bracelets', accepts: 'bracelets' },
  { id: 'ring1', accepts: 'ring' },
  { id: 'ring2', accepts: 'ring' },
  { id: 'facewear', accepts: 'facewear' },
  { id: 'ornament', accepts: 'ornament' },
] as const;
