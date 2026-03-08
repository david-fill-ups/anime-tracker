import { PrismaClient } from "../app/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import * as path from "path";

const dbPath = path.resolve(process.cwd(), "dev.db");
const adapter = new PrismaBetterSqlite3({ url: dbPath });
const prisma = new PrismaClient({ adapter } as any);

interface RawRow {
  series: string;
  lastWatched: string;
  rating: string;
  watchParty: string;
  note: string;
}

// Raw spreadsheet data (tab-separated columns: Series | Last Watched | Rating | Watch Party | Note)
const RAW_DATA: RawRow[] = [
  { series: "Accel World", lastWatched: "S1 E24", rating: "6", watchParty: "Solo", note: "" },
  { series: "Aggretsuko", lastWatched: "S3 E4", rating: "4", watchParty: "Christine", note: "" },
  { series: "Akama Ga Kill", lastWatched: "S1 E24", rating: "5", watchParty: "Solo", note: "" },
  { series: "akashic records of bastard magic instructor", lastWatched: "S1 E12", rating: "", watchParty: "", note: "" },
  { series: "Akudama Drive", lastWatched: "S1 E12", rating: "3", watchParty: "", note: "" },
  { series: "Arcane: League of Legends", lastWatched: "S1 E9", rating: "4", watchParty: "", note: "" },
  { series: "Assassination Classroom", lastWatched: "S2 E25", rating: "7", watchParty: "", note: "" },
  { series: "Attack on Titan", lastWatched: "S4 E28", rating: "7", watchParty: "", note: "" },
  { series: "Avatar: The Last Airbender", lastWatched: "S3 E21", rating: "8", watchParty: "", note: "" },
  { series: "Avatar: The Legend of Korra", lastWatched: "S4 E13", rating: "5", watchParty: "", note: "" },
  { series: "Black Butler", lastWatched: "S3 E10", rating: "6", watchParty: "", note: "" },
  { series: "Black Clover", lastWatched: "S4 E16", rating: "7", watchParty: "", note: "" },
  { series: "Bleach", lastWatched: "S16 E24", rating: "", watchParty: "", note: "" },
  { series: "Bleach: Thousand-Year Blood War", lastWatched: "S2 E26", rating: "", watchParty: "", note: "" },
  { series: "Blue Exorcist", lastWatched: "S2 E12", rating: "", watchParty: "", note: "" },
  { series: "Bofuri: I Don't Want to Get Hurt, so I'll Max Out My Defense", lastWatched: "S2 E12", rating: "", watchParty: "", note: "" },
  { series: "Boruto", lastWatched: "S1 E293", rating: "", watchParty: "", note: "" },
  { series: "By the Grace of the Gods", lastWatched: "S1 E12", rating: "", watchParty: "", note: "" },
  { series: "Cautious Hero: The Hero Is Overpowered but Overly Cautious", lastWatched: "S1 E12", rating: "", watchParty: "", note: "" },
  { series: "Chainsaw Man", lastWatched: "S1 E12", rating: "", watchParty: "", note: "" },
  { series: "Charlotte", lastWatched: "S1 E13", rating: "", watchParty: "", note: "" },
  { series: "Children of the Whales", lastWatched: "S1 E12", rating: "", watchParty: "", note: "" },
  { series: "Chivalry of a Failed Knight", lastWatched: "S1 E12", rating: "", watchParty: "", note: "" },
  { series: "Classroom of the Elite", lastWatched: "S3 E9", rating: "", watchParty: "", note: "" },
  { series: "Code Geass", lastWatched: "S2 E25", rating: "", watchParty: "", note: "" },
  { series: "Darwin's Game", lastWatched: "S1 E11", rating: "", watchParty: "", note: "" },
  { series: "Death Note", lastWatched: "S1 E37", rating: "", watchParty: "", note: "" },
  { series: "Death Parade", lastWatched: "S1 E12", rating: "", watchParty: "", note: "" },
  { series: "Demon Lord, Retry!", lastWatched: "S1 E12", rating: "", watchParty: "", note: "" },
  { series: "Demon Slayer", lastWatched: "S3 E11", rating: "", watchParty: "", note: "" },
  { series: "DOTA: Dragon's Blood", lastWatched: "S1 E8", rating: "", watchParty: "", note: "" },
  { series: "Dr. Stone", lastWatched: "S3 E22", rating: "", watchParty: "", note: "" },
  { series: "Dragon Ball", lastWatched: "S1 E153", rating: "", watchParty: "", note: "" },
  { series: "Dragon Ball GT", lastWatched: "S1 E64", rating: "", watchParty: "", note: "" },
  { series: "Dragon Ball Super", lastWatched: "S1 E131", rating: "", watchParty: "", note: "" },
  { series: "Dragon Ball Z", lastWatched: "S9 E38", rating: "", watchParty: "", note: "" },
  { series: "Erased", lastWatched: "S1 E12", rating: "", watchParty: "", note: "" },
  { series: "Fairy Tail", lastWatched: "S3 E328", rating: "", watchParty: "", note: "" },
  { series: "Fire Force", lastWatched: "S2 E24", rating: "", watchParty: "", note: "" },
  { series: "Food Wars!", lastWatched: "S5 E13", rating: "", watchParty: "", note: "" },
  { series: "Forest of Piano", lastWatched: "S2 E12", rating: "", watchParty: "", note: "" },
  { series: "Fruits Basket", lastWatched: "S1 E21", rating: "", watchParty: "", note: "" },
  { series: "Fruits Basket (2001)", lastWatched: "S1 E26", rating: "", watchParty: "", note: "" },
  { series: "Fullmetal Alchemist: Brotherhood", lastWatched: "S1 E64", rating: "", watchParty: "", note: "" },
  { series: "Gintama", lastWatched: "S1 E49", rating: "", watchParty: "", note: "" },
  { series: "Hell's Paradise", lastWatched: "", rating: "", watchParty: "", note: "" },
  { series: "High School of the Dead", lastWatched: "S1 E12", rating: "", watchParty: "", note: "" },
  { series: "Hunter x Hunter", lastWatched: "S1 E148", rating: "", watchParty: "", note: "" },
  { series: "Inuyasha", lastWatched: "S5 E26", rating: "", watchParty: "", note: "" },
  { series: "Is It Wrong to Try to Pick Up Girls in a Dungeon?", lastWatched: "S4.end", rating: "", watchParty: "", note: "" },
  { series: "JoJo's Bizarre Adventure", lastWatched: "S5 E38", rating: "", watchParty: "", note: "" },
  { series: "Jujutsu Kaisen", lastWatched: "S1 E24", rating: "", watchParty: "", note: "" },
  { series: "Kaguya-sama: Love Is War", lastWatched: "S1 E12", rating: "", watchParty: "", note: "" },
  { series: "Kakegurui", lastWatched: "S2 E12", rating: "", watchParty: "", note: "" },
  { series: "Komi Can't Communicate", lastWatched: "S2 E12", rating: "", watchParty: "", note: "" },
  { series: "Lost Song", lastWatched: "S1 E12", rating: "", watchParty: "", note: "" },
  { series: "Mashle: Magic and Muscles", lastWatched: "", rating: "", watchParty: "", note: "(Matt said just watch without him)" },
  { series: "Mieruko-chan", lastWatched: "S1 E12", rating: "", watchParty: "", note: "" },
  { series: "Mushoku Tensei: Jobless Reincarnation", lastWatched: "S2 E12", rating: "", watchParty: "", note: "" },
  { series: "My Happy Marriage", lastWatched: "finished season 1", rating: "", watchParty: "", note: "" },
  { series: "My Hero Academia", lastWatched: "S5 E25", rating: "", watchParty: "", note: "" },
  { series: "Naruto", lastWatched: "S5 E220", rating: "", watchParty: "", note: "" },
  { series: "Naruto Shippuden", lastWatched: "S21 E500", rating: "", watchParty: "", note: "" },
  { series: "Neon Genesis Evangelion", lastWatched: "S1 E26", rating: "", watchParty: "", note: "" },
  { series: "No Game No Life!", lastWatched: "S1 E12", rating: "", watchParty: "", note: "" },
  { series: "One Piece", lastWatched: "S14 E8", rating: "", watchParty: "Matt", note: "" },
  { series: "One Punch Man", lastWatched: "S2 E24", rating: "", watchParty: "", note: "" },
  { series: "Ouran High School Host Club", lastWatched: "S1 E64", rating: "", watchParty: "", note: "" },
  { series: "Overlord", lastWatched: "S2.end", rating: "", watchParty: "", note: "" },
  { series: "Parasyte", lastWatched: "S1 E24", rating: "", watchParty: "", note: "" },
  { series: "Platinum End", lastWatched: "S1 E24", rating: "", watchParty: "", note: "" },
  { series: "Pokemon", lastWatched: ".Completed", rating: "", watchParty: "", note: "" },
  { series: "Re:Zero", lastWatched: "S2 E12", rating: "", watchParty: "", note: "(Matt said just watch without him)" },
  { series: "Rising of the Shield Hero", lastWatched: "S2 E13", rating: "", watchParty: "", note: "" },
  { series: "Sailor Moon", lastWatched: "", rating: "", watchParty: "", note: "" },
  { series: "Seraph of the End", lastWatched: "S2 E12", rating: "", watchParty: "", note: "" },
  { series: "Seven Deadly Sins", lastWatched: "S5 E24", rating: "", watchParty: "", note: "" },
  { series: "Shaman King", lastWatched: "S1 E52", rating: "", watchParty: "", note: "" },
  { series: "Solo Leveling", lastWatched: "S1", rating: "", watchParty: "", note: "" },
  { series: "Spriggan", lastWatched: "", rating: "", watchParty: "", note: "" },
  { series: "Sword Art Online", lastWatched: "S1 E25", rating: "", watchParty: "", note: "" },
  { series: "Sword Art Online II", lastWatched: "S2 E24", rating: "", watchParty: "", note: "" },
  { series: "Sword Art Online Alternative: Gun Gale Online", lastWatched: "S1 E12", rating: "", watchParty: "", note: "" },
  { series: "Sword Art Online: Alicization", lastWatched: "S3 E23", rating: "", watchParty: "", note: "" },
  { series: "That Time I Got Reincarnated as a Slime", lastWatched: "S2 E12", rating: "", watchParty: "", note: "" },
  { series: "The Daily Life of the Immortal King", lastWatched: "", rating: "", watchParty: "", note: "" },
  { series: "The Devil is a Part-Timer!", lastWatched: "", rating: "", watchParty: "", note: "(Matt said just watch without him)" },
  { series: "The Eminence in Shadow", lastWatched: "S1 E20", rating: "", watchParty: "", note: "" },
  { series: "The Greatest Demon Lord Is Reborn as a Typical Nobody", lastWatched: "S1 E12", rating: "", watchParty: "", note: "" },
  { series: "The Promised Neverland", lastWatched: "S2 E11", rating: "", watchParty: "", note: "" },
  { series: "Toilet-bound Hanako-kun", lastWatched: "S1 E12", rating: "", watchParty: "", note: "" },
  { series: "Tokyo Ghoul", lastWatched: "S4 E12", rating: "", watchParty: "", note: "" },
  { series: "Totoro Lives Alone", lastWatched: "", rating: "", watchParty: "", note: "" },
  { series: "Vinland Saga", lastWatched: "S2 E24", rating: "", watchParty: "", note: "(Matt said just watch without him)" },
  { series: "Violet Evergarden", lastWatched: "S1 E13", rating: "", watchParty: "", note: "" },
  { series: "Yamada-kun and the Seven Witches", lastWatched: "S1 E12", rating: "", watchParty: "", note: "" },
  { series: "Your Lie in April", lastWatched: "S1 E22", rating: "", watchParty: "", note: "" },
  { series: "Yu-Gi-Oh! GX", lastWatched: "", rating: "", watchParty: "", note: "" },
  { series: "Yu-Gi-Oh!", lastWatched: "S5 E52", rating: "", watchParty: "", note: "" },
  { series: "Yu Yu Hakusho", lastWatched: "S4 E19", rating: "", watchParty: "", note: "" },
  { series: "Zom 100: Bucket List of the Dead", lastWatched: "", rating: "", watchParty: "Matt", note: "" },
  { series: "Made in Abyss", lastWatched: "", rating: "", watchParty: "", note: "(Matt said just watch without him)" },
  { series: "Frieren: Beyond Journey's End", lastWatched: "", rating: "", watchParty: "Solo", note: "" },
  { series: "A Returner's Magic Should Be Special", lastWatched: "S1 E12", rating: "", watchParty: "", note: "" },
  { series: "The World's Finest Assassin Gets Reincarnated in Another World as an Aristocrat", lastWatched: "S1 E12", rating: "", watchParty: "", note: "" },
  { series: "Rurouni Kenshin (2023)", lastWatched: "S2 E47", rating: "", watchParty: "", note: "" },
  { series: "The Wrong Way to Use Healing Magic", lastWatched: "", rating: "", watchParty: "", note: "" },
  { series: "Gnome Hunter", lastWatched: "", rating: "", watchParty: "", note: "" },
  { series: "KonoSuba: God's Blessing on This Wonderful World!", lastWatched: "", rating: "", watchParty: "", note: "" },
  { series: "Fate/stay night", lastWatched: "", rating: "", watchParty: "", note: "" },
  { series: "Redo of Healer", lastWatched: "", rating: "", watchParty: "", note: "" },
  { series: "Oshi no Ko", lastWatched: "active", rating: "", watchParty: "", note: "" },
  { series: "Fate/Zero", lastWatched: "S2E25", rating: "", watchParty: "", note: "" },
  { series: "Chillin' in My 30s After Getting Fired from the Demon King's Army", lastWatched: "s1e12", rating: "", watchParty: "", note: "" },
  { series: "Plunderer", lastWatched: "", rating: "", watchParty: "", note: "" },
  { series: "Seirei Gensouki: Spirit Chronicles", lastWatched: "", rating: "", watchParty: "", note: "" },
  { series: "Dragon Ball Daima", lastWatched: "", rating: "", watchParty: "", note: "" },
  { series: "The Do-Over Damsel Conquers the Dragon Emperor", lastWatched: "", rating: "", watchParty: "", note: "" },
  { series: "Shangri-La Frontier", lastWatched: "", rating: "", watchParty: "", note: "" },
  { series: "The Unwanted Undead Adventurer", lastWatched: "", rating: "", watchParty: "", note: "" },
  { series: "Reborn to Master the Blade: From Hero-King to Extraordinary Squire", lastWatched: "", rating: "", watchParty: "", note: "" },
  { series: "Interviews with Monster Girls", lastWatched: "", rating: "", watchParty: "", note: "" },
  { series: "Campfire Cooking in Another World with My Absurd Skill", lastWatched: "", rating: "", watchParty: "", note: "" },
  { series: "Failure Frame: I Became the Strongest and Annihilated Everything with Low-Level Spells", lastWatched: "", rating: "", watchParty: "", note: "" },
  { series: "Tower of God", lastWatched: "", rating: "", watchParty: "", note: "" },
  { series: "Black Summoner", lastWatched: "", rating: "", watchParty: "", note: "" },
  { series: "Kaze no Stigma", lastWatched: "", rating: "", watchParty: "", note: "" },
  { series: "Magi: The Labyrinth of Magic", lastWatched: "", rating: "", watchParty: "", note: "" },
  { series: "Grimgar: Ashes and Illusions", lastWatched: "", rating: "", watchParty: "", note: "" },
  { series: "Kaiju No. 8", lastWatched: "", rating: "", watchParty: "", note: "" },
  { series: "No Longer Allowed in Another World", lastWatched: "", rating: "", watchParty: "", note: "" },
  { series: "Kuma Kuma Kuma Bear", lastWatched: "", rating: "", watchParty: "", note: "" },
  { series: "Wistoria: Wand and Sword", lastWatched: "", rating: "", watchParty: "", note: "" },
  { series: "The Brilliant Healer's New Life in the Shadows", lastWatched: "", rating: "", watchParty: "", note: "" },
  { series: "Bartender: Glass of God", lastWatched: "", rating: "", watchParty: "Matt", note: "" },
  { series: "The Misfit of Demon King Academy", lastWatched: "", rating: "", watchParty: "", note: "" },
  { series: "A Herbivorous Dragon of 5,000 Years Gets Unfairly Villainized", lastWatched: "", rating: "", watchParty: "", note: "" },
  { series: "The Unaware Atelier Master", lastWatched: "", rating: "", watchParty: "", note: "" },
  { series: "The Great Cleric", lastWatched: "", rating: "", watchParty: "", note: "" },
  { series: "Parallel World Pharmacy", lastWatched: "", rating: "", watchParty: "", note: "" },
  { series: "If It's for My Daughter, I'd Even Defeat a Demon Lord", lastWatched: "", rating: "", watchParty: "", note: "" },
  { series: "Ascendance of a Bookworm", lastWatched: "", rating: "", watchParty: "", note: "" },
  { series: "As a Reincarnated Aristocrat, I'll Use My Appraisal Skill to Rise in the World", lastWatched: "", rating: "", watchParty: "", note: "" },
  { series: "Am I Actually the Strongest?", lastWatched: "", rating: "", watchParty: "", note: "" },
  { series: "Scooped Up by an S-Ranked Adventurer", lastWatched: "", rating: "", watchParty: "", note: "" },
  { series: "The Ossan Newbie Adventurer, Trained to Death by the Most Powerful Party, Became Invincible", lastWatched: "", rating: "", watchParty: "", note: "" },
  { series: "I Shall Survive Using Potions!", lastWatched: "", rating: "", watchParty: "", note: "" },
  { series: "Tokyo Revengers", lastWatched: "", rating: "", watchParty: "", note: "" },
  { series: "Even Given the Worthless 'Appraiser' Class, I'm Actually the Strongest", lastWatched: "", rating: "", watchParty: "", note: "" },
  { series: "Faraway Paladin", lastWatched: "", rating: "", watchParty: "", note: "" },
  { series: "Shakugan no Shana", lastWatched: "active", rating: "", watchParty: "", note: "" },
  { series: "I Was Reincarnated as the 7th Prince", lastWatched: "", rating: "", watchParty: "", note: "" },
  { series: "Lord of Mysteries", lastWatched: "", rating: "", watchParty: "", note: "" },
  { series: "The Beginning After the End", lastWatched: "", rating: "", watchParty: "", note: "" },
  { series: "The Water Magician", lastWatched: "", rating: "", watchParty: "", note: "" },
  { series: "Uglymug, Epic Fighter", lastWatched: "", rating: "", watchParty: "", note: "" },
  { series: "The Reincarnation of the Strongest Exorcist in Another World", lastWatched: "", rating: "", watchParty: "", note: "" },
  { series: "Welcome to Demon School! Iruma-kun", lastWatched: "", rating: "", watchParty: "", note: "" },
  { series: "A Gatherer's Adventure in Isekai", lastWatched: "", rating: "", watchParty: "", note: "" },
  { series: "The Strongest Sage with the Weakest Crest", lastWatched: "", rating: "", watchParty: "", note: "" },
  { series: "Re:Monster", lastWatched: "", rating: "", watchParty: "", note: "" },
  { series: "Roll Over and Die", lastWatched: "active", rating: "", watchParty: "", note: "" },
  { series: "Sugar Apple Fairy Tale", lastWatched: "active", rating: "", watchParty: "", note: "" },
  { series: "Dan Da Dan", lastWatched: "active", rating: "", watchParty: "", note: "" },
  { series: "Jack of All Trades, Master of None", lastWatched: "", rating: "", watchParty: "", note: "" },
];

// --- Parsing helpers ---

function parseLastWatched(
  lastWatched: string,
  hasRating: boolean
): { currentEpisode: number; watchStatus: string } {
  const lw = lastWatched.trim();

  if (!lw) {
    return { currentEpisode: 0, watchStatus: "PLAN_TO_WATCH" };
  }

  if (lw.toLowerCase() === "active") {
    return { currentEpisode: 0, watchStatus: "WATCHING" };
  }

  const lwLower = lw.toLowerCase();
  const isCompleted =
    lwLower === ".completed" ||
    lwLower.endsWith(".end") ||
    lwLower.includes("finished") ||
    lwLower.includes("completed");

  if (isCompleted) {
    // Try to extract an episode number if present (e.g., "S4.end" has no E, ".Completed" has no E)
    const epMatch = lw.match(/[Ee](\d+)/i);
    return {
      currentEpisode: epMatch ? parseInt(epMatch[1]) : 0,
      watchStatus: "COMPLETED",
    };
  }

  // S1 E24, S2E25, s1e12, etc.
  const epMatch = lw.match(/[Ee](\d+)/i);
  if (epMatch) {
    const currentEpisode = parseInt(epMatch[1]);
    return {
      currentEpisode,
      watchStatus: hasRating ? "COMPLETED" : "WATCHING",
    };
  }

  // "S1" alone — season data with no episode number
  if (lw.match(/^[Ss]\d+$/)) {
    return { currentEpisode: 0, watchStatus: "WATCHING" };
  }

  return { currentEpisode: 0, watchStatus: "PLAN_TO_WATCH" };
}

function parseWatchContext(
  watchParty: string
): { watchContext: string | null; watchPartyWith: string | null } {
  const wp = watchParty.trim();
  if (!wp) return { watchContext: null, watchPartyWith: null };
  if (wp.toLowerCase() === "solo") return { watchContext: "SOLO", watchPartyWith: null };
  return { watchContext: "WATCH_PARTY", watchPartyWith: wp };
}

// --- Main ---

async function main() {
  console.log("Clearing existing anime data...");
  await prisma.userEntry.deleteMany();
  await prisma.animeStudio.deleteMany();
  await prisma.franchiseEntry.deleteMany();
  await prisma.anime.deleteMany();

  console.log("Creating people (Matt, Christine)...");
  await prisma.person.upsert({
    where: { name: "Matt" },
    create: { name: "Matt" },
    update: {},
  });
  await prisma.person.upsert({
    where: { name: "Christine" },
    create: { name: "Christine" },
    update: {},
  });

  console.log(`Seeding ${RAW_DATA.length} anime entries...`);
  let created = 0;

  for (const row of RAW_DATA) {
    // Normalize: if rating is non-numeric (e.g., a name in wrong column), treat as watchParty
    let ratingStr = row.rating.trim();
    let watchPartyStr = row.watchParty.trim();
    if (ratingStr && isNaN(parseFloat(ratingStr))) {
      if (!watchPartyStr) watchPartyStr = ratingStr;
      ratingStr = "";
    }

    const hasRating = ratingStr !== "";
    const score = hasRating ? parseFloat(ratingStr) : null;
    const { currentEpisode, watchStatus } = parseLastWatched(row.lastWatched, hasRating);
    const { watchContext, watchPartyWith } = parseWatchContext(watchPartyStr);
    const notes = row.note.trim() || null;

    await prisma.anime.create({
      data: {
        titleRomaji: row.series,
        source: "MANUAL",
        userEntry: {
          create: {
            watchStatus: watchStatus as any,
            currentEpisode,
            score,
            notes,
            watchContext: watchContext as any,
            watchPartyWith,
          },
        },
      },
    });

    created++;
    if (created % 20 === 0) {
      console.log(`  ${created}/${RAW_DATA.length}...`);
    }
  }

  console.log(`\nDone! Created ${created} anime entries.`);
  console.log("People created: Matt, Christine");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
