export type SavedCardSet = {
  id: string;
  name: string;
  description: string;
  cards: Array<{
    name: string;
    quantity?: number;
  }>;
};

export const defaultSavedCardSets: SavedCardSet[] = [
  {
    id: "joy-card-set",
    name: "Joy Card Set",
    description: "A starter import based on the supplied classic card-set image. Imports into Extra Cards for manual sorting.",
    cards: [
      { name: "Arcana Knight Joker" },
      { name: "Airknight Parshath" },
      { name: "Baby Dragon" },
      { name: "Battle Warrior" },
      { name: "Black Pendant" },
      { name: "Block Attack" },
      { name: "Blue-Eyes Toon Dragon", quantity: 2 },
      { name: "Brain Control" },
      { name: "Clown Zombie" },
      { name: "De-Spell" },
      { name: "Dragon Capture Jar" },
      { name: "Elegant Egotist" },
      { name: "Flame Manipulator" },
      { name: "Flame Swordsman" },
      { name: "Fusion Gate" },
      { name: "Gaia The Dragon Champion" },
      { name: "Giltia the D. Knight" },
      { name: "Goblin Attack Force", quantity: 2 },
      { name: "Graceful Charity" },
      { name: "Graceful Dice" },
      { name: "Harpie Lady Sisters" },
      { name: "Jinzo" },
      { name: "Karbonala Warrior" },
      { name: "Kunai with Chain" },
      { name: "Legendary Sword" },
      { name: "Magic Jammer" },
      { name: "Monster Reborn" },
      { name: "Mystical Space Typhoon" },
      { name: "Polymerization", quantity: 2 },
      { name: "Raigeki" },
      { name: "Raigeki Break" },
      { name: "Red-Eyes Black Dragon" },
      { name: "Remove Trap" },
      { name: "Salamandra" },
      { name: "Scapegoat" },
      { name: "Seven Tools of the Bandit" },
      { name: "Skull Dice" },
      { name: "Soul Exchange" },
      { name: "Swordsman of Landstar" },
      { name: "The Flute of Summoning Dragon" },
      { name: "Thousand Dragon" },
      { name: "Time Wizard", quantity: 2 },
      { name: "Toon Mermaid" },
      { name: "Toon Summoned Skull" },
      { name: "Trap Hole" }
    ]
  }
];
