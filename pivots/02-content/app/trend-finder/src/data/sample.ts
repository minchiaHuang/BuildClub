// SAMPLE DATA. Every account, number and caption below is made up to show how the app works.
// Replace with real videos collected by hand (see README.md for the fields).

import type { Client, Format, SavedIdea, Video } from '../types'

export const formats: Format[] = [
  {
    id: 'crispy-asmr',
    name: 'Crispy tofu ASMR, top-down',
    short: 'crispy tofu',
    tags: ['crispy', 'crunchy', 'crunch', 'asmr', 'fried', 'fry', 'sizzle'],
    audiences: ['students', 'young professionals', 'busy mums'],
    summary: 'Overhead pan shot, loud sizzle, no talking. Text hook promises speed.',
    why: {
      hook: 'Text on screen promises a result in a short time ("crispy in 5 min").',
      first3s: 'Tofu hits hot oil in the first second. The sizzle sound stops the scroll.',
      length: '12–15 seconds. Short enough to watch twice, which boosts replays.',
      format: 'One fixed top-down camera. No face, no voice. Easy to copy.',
      sound: 'Real cooking sound only, turned up. No music.',
    },
    shotList: [
      { time: '0–2s', shot: 'Top-down: tofu cubes drop into hot oil', text: 'Crispy tofu in 5 min' },
      { time: '2–6s', shot: 'Close-up: cubes turning golden, tongs flipping' },
      { time: '6–10s', shot: 'Sauce poured over, quick toss in the pan' },
      { time: '10–14s', shot: 'Plated, one piece pulled apart to show the crunch', text: 'Save this' },
    ],
    props: ['Pan', 'Tongs', 'Tofu', 'Sauce', 'Overhead phone mount'],
    needs: ['A kitchen', 'An overhead phone mount'],
    effort: 'easy',
    editorNotes: 'Keep the sizzle loud. Cut on each flip. Text hook in the first frame, large and centred.',
  },
  {
    id: 'blind-taste-test',
    name: 'Street blind taste test: "Is it chicken?"',
    short: 'tofu taste tests',
    tags: ['taste test', 'blind', 'street', 'chicken', 'guess', 'strangers', 'reaction'],
    audiences: ['young professionals', 'students'],
    summary: 'Ask people on the street to guess what they are eating. Reveal: it is tofu.',
    why: {
      hook: 'A question the viewer wants to answer too ("Can you tell it is tofu?").',
      first3s: 'A stranger takes a bite and pulls a face. Curiosity keeps people watching.',
      length: '20–30 seconds, with 3–4 people so the reveal pays off.',
      format: 'Handheld on the street. Real reactions, not actors.',
      sound: 'Natural voices plus a light trending sound underneath.',
    },
    shotList: [
      { time: '0–3s', shot: 'Handheld: offer a bite to a stranger', text: 'Is this chicken?' },
      { time: '3–15s', shot: 'Three quick reactions, one guess each' },
      { time: '15–22s', shot: 'Reveal the packet to camera', text: "It's tofu" },
      { time: '22–26s', shot: 'Best surprised reaction, slowed down' },
    ],
    props: ['Cooked tofu in a container', 'Forks', 'The product packet', 'Small mic'],
    needs: ['People willing to be filmed on the street', 'A busy public spot'],
    effort: 'medium',
    editorNotes: 'Open on the strongest reaction. Subtitles on every line. Packet must be readable at the reveal.',
  },
  {
    id: 'three-ingredient-dessert',
    name: '3-ingredient tofu dessert',
    short: 'tofu desserts',
    tags: ['dessert', 'sweet', 'mousse', 'pudding', 'cheesecake', 'chocolate', '3 ingredient', '3-ingredient'],
    audiences: ['busy mums', 'families', 'health-conscious eaters'],
    summary: 'Silken tofu blended into a dessert. Ingredients counted on screen.',
    why: {
      hook: 'A surprising use ("dessert made from tofu") plus a small number ("3 ingredients").',
      first3s: 'Three ingredients lined up on the bench with numbers on screen.',
      length: '25–35 seconds.',
      format: 'Recipe steps with fast cuts.',
      sound: 'Trending upbeat song.',
    },
    shotList: [
      { time: '0–3s', shot: 'Three ingredients on the bench', text: '3-ingredient dessert' },
      { time: '3–15s', shot: 'Blend, pour into cups, chill (time-lapse)' },
      { time: '15–25s', shot: 'Spoon breaks the top, close-up of texture', text: 'Made with tofu' },
    ],
    props: ['Silken tofu', 'Blender', 'Cups', 'Chocolate or fruit'],
    needs: ['A kitchen', 'A blender'],
    effort: 'easy',
    editorNotes: 'Number each ingredient on screen. Keep cuts under 2 seconds until the reveal.',
  },
  {
    id: 'buying-wrong',
    name: '"You are buying tofu wrong" supermarket guide',
    short: 'tofu buying guides',
    tags: ['supermarket', 'grocery', 'buying', 'buy', 'types', 'guide', 'aisle'],
    audiences: ['busy mums', 'families'],
    summary: 'Filmed in the supermarket aisle. Explains which tofu to buy for which dish.',
    why: {
      hook: 'Tells viewers they are making a mistake. People watch to check.',
      first3s: 'Presenter points at the fridge shelf and says the hook to camera.',
      length: '30–45 seconds.',
      format: 'Talking to camera in a real store.',
      sound: 'Voice only.',
    },
    shotList: [
      { time: '0–3s', shot: 'Presenter at the fridge shelf, talking to camera', text: "You're buying tofu wrong" },
      { time: '3–30s', shot: 'Pick up each type: silken, firm, extra firm. One use each.' },
      { time: '30–40s', shot: 'Hold up the brand packet', text: 'Firm = stir-fry' },
    ],
    props: ['Three types of tofu', 'Store permission to film'],
    needs: ['Permission to film in a supermarket', 'A confident presenter'],
    effort: 'hard',
    editorNotes: 'Add a label for each tofu type as it is picked up. Keep the presenter centred.',
  },
  {
    id: 'press-hack',
    name: 'Pressing tofu without a press',
    short: 'tofu hacks',
    tags: ['hack', 'press', 'pressing', 'tip', 'trick'],
    audiences: ['students', 'young professionals'],
    summary: 'Kitchen hack using a tea towel and a heavy book.',
    why: {
      hook: 'A hack that saves buying a gadget.',
      first3s: 'Heavy book lands on the tofu.',
      length: 'About 15 seconds.',
      format: 'Single hack, one location.',
      sound: 'Trending sound.',
    },
    shotList: [
      { time: '0–3s', shot: 'Book drops onto tofu wrapped in a towel', text: 'No tofu press? Do this' },
      { time: '3–10s', shot: 'Water squeezed out, close-up' },
      { time: '10–15s', shot: 'Pressed tofu sliced cleanly' },
    ],
    props: ['Tofu', 'Tea towel', 'Heavy book or pan'],
    needs: ['A kitchen'],
    effort: 'easy',
    editorNotes: 'Speed up the waiting part. Show the water clearly.',
  },
]

const v = (
  id: string,
  platform: Video['platform'],
  handle: string,
  hook: string,
  views: number,
  followers: number,
  medianViews: number,
  daysAgo: number,
  lengthSec: number,
  shares: number,
  saves: number | null,
  formatId: string,
): Video => ({
  id, platform, handle, hook, views, followers, medianViews, daysAgo, lengthSec, shares, saves, formatId,
  keywords: ['tofu'],
})

export const videos: Video[] = [
  // Crispy ASMR: big on TikTok, barely on Instagram yet
  v('t1', 'tiktok', '@smallkitchen.sample', 'Crispy tofu in 5 min', 2_400_000, 3_100, 9_000, 9, 13, 41_000, 120_000, 'crispy-asmr'),
  v('t2', 'tiktok', '@weeknight.wok.sample', 'The crunch at the end', 980_000, 12_000, 20_000, 6, 14, 15_000, 48_000, 'crispy-asmr'),
  v('t3', 'tiktok', '@plantplates.sample', 'Tofu that crunches like chips', 1_300_000, 45_000, 60_000, 4, 12, 22_000, 70_000, 'crispy-asmr'),
  v('t4', 'tiktok', '@uni.eats.sample', 'Student budget crispy tofu', 610_000, 2_200, 4_000, 3, 15, 9_000, 30_000, 'crispy-asmr'),
  v('t5', 'tiktok', '@sydney.cooks.sample', 'Air fryer? No. Pan.', 420_000, 8_500, 11_000, 2, 13, 5_200, 19_000, 'crispy-asmr'),
  v('i1', 'instagram', '@greenbowl.sample', 'Crispy tofu, no air fryer', 310_000, 6_400, 14_000, 2, 15, 6_100, null, 'crispy-asmr'),

  // Blind taste test: growing on both
  v('t6', 'tiktok', '@streettaste.sample', 'Is this chicken?', 3_100_000, 88_000, 140_000, 12, 26, 60_000, 52_000, 'blind-taste-test'),
  v('t7', 'tiktok', '@cbd.foodie.sample', 'Nobody guessed it', 740_000, 5_600, 12_000, 7, 24, 11_000, 9_000, 'blind-taste-test'),
  v('t8', 'tiktok', '@askstrangers.sample', 'Guess the meat (it is not meat)', 520_000, 19_000, 30_000, 5, 29, 8_000, 6_500, 'blind-taste-test'),
  v('i2', 'instagram', '@sydneybites.sample', 'We fooled George St', 1_050_000, 2_900, 7_500, 6, 27, 18_000, null, 'blind-taste-test'),
  v('i3', 'instagram', '@meatless.mates.sample', 'Chicken or tofu?', 460_000, 15_000, 25_000, 4, 22, 7_400, null, 'blind-taste-test'),
  v('i4', 'instagram', '@eat.the.city.sample', 'Blind taste test at Central', 280_000, 41_000, 38_000, 3, 25, 3_100, null, 'blind-taste-test'),

  // 3-ingredient dessert: everywhere, older
  v('t9', 'tiktok', '@sweetswap.sample', '3-ingredient chocolate mousse', 4_200_000, 210_000, 300_000, 34, 31, 70_000, 400_000, 'three-ingredient-dessert'),
  v('t10', 'tiktok', '@lazy.dessert.sample', 'Protein pudding from tofu', 900_000, 33_000, 45_000, 28, 28, 12_000, 95_000, 'three-ingredient-dessert'),
  v('t11', 'tiktok', '@bake.less.sample', 'No-bake tofu cheesecake', 650_000, 70_000, 80_000, 25, 33, 7_000, 60_000, 'three-ingredient-dessert'),
  v('t12', 'tiktok', '@healthyish.sample', 'Dessert you would not guess', 300_000, 120_000, 90_000, 22, 30, 2_500, 21_000, 'three-ingredient-dessert'),
  v('i5', 'instagram', '@spoonful.sample', '3-ingredient mousse', 2_000_000, 160_000, 120_000, 30, 32, 40_000, null, 'three-ingredient-dessert'),
  v('i6', 'instagram', '@goodmood.food.sample', 'Silken tofu dessert', 720_000, 28_000, 30_000, 26, 29, 10_000, null, 'three-ingredient-dessert'),
  v('i7', 'instagram', '@mumsmeals.sample', 'Kids could not tell', 390_000, 9_800, 15_000, 21, 34, 6_200, null, 'three-ingredient-dessert'),
  v('i8', 'instagram', '@easy.eats.sample', 'Tofu chocolate pots', 210_000, 54_000, 40_000, 18, 27, 2_000, null, 'three-ingredient-dessert'),

  // Buying wrong: Instagram first
  v('i9', 'instagram', '@aisle.guide.sample', "You're buying tofu wrong", 1_600_000, 4_300, 10_000, 8, 41, 30_000, null, 'buying-wrong'),
  v('i10', 'instagram', '@chef.explains.sample', 'Which tofu for which dish', 640_000, 22_000, 35_000, 5, 38, 12_000, null, 'buying-wrong'),
  v('i11', 'instagram', '@grocery.hacks.sample', 'Stop buying silken for stir-fry', 350_000, 11_000, 16_000, 3, 36, 5_000, null, 'buying-wrong'),
  v('t13', 'tiktok', '@shopsmart.sample', 'Tofu types explained', 150_000, 60_000, 70_000, 2, 44, 1_800, 6_000, 'buying-wrong'),

  // Press hack: one-off
  v('t14', 'tiktok', '@kitchen.tricks.sample', 'No tofu press? Do this', 380_000, 140_000, 160_000, 15, 15, 3_000, 22_000, 'press-hack'),
  v('i12', 'instagram', '@tidy.kitchen.sample', 'Tofu press hack', 95_000, 31_000, 40_000, 11, 16, 900, null, 'press-hack'),
]

export const clients: Client[] = [
  {
    id: 'evergreen',
    name: 'Evergreen Foods',
    niche: 'Tofu brand sold at Woolworths',
    audience: 'Busy mums and young professionals',
    monthlyTarget: 12,
    cannot: ['Permission to film in a supermarket'],
  },
  {
    id: 'student-eats',
    name: 'Campus Kitchen (example)',
    niche: 'Student meal kits',
    audience: 'Uni students',
    monthlyTarget: 8,
    cannot: ['People willing to be filmed on the street', 'A confident presenter'],
  },
]

// Sample saved ideas so the overview, approvals and plans pages aren't empty on first open.
const inDays = (n: number) => {
  const d = new Date()
  d.setDate(d.getDate() + n)
  return d.toISOString().slice(0, 10)
}

const idea = (clientId: string, videoId: string, status: SavedIdea['status'], due: number): SavedIdea => {
  const formatId = videos.find((v) => v.id === videoId)!.formatId
  return {
    id: `${clientId}-${videoId}`,
    videoId,
    clientId,
    status,
    dueDate: inDays(due),
    notes: formats.find((f) => f.id === formatId)!.editorNotes,
  }
}

export const sampleIdeas: SavedIdea[] = [
  idea('evergreen', 't1', 'approved', 2),
  idea('evergreen', 't9', 'approved', 5),
  idea('evergreen', 'i2', 'approved', 8),
  idea('evergreen', 't6', 'approved', 12),
  idea('evergreen', 'i5', 'approved', 15),
  idea('evergreen', 't2', 'waiting', 14),
  idea('evergreen', 'i6', 'waiting', 14),
  idea('evergreen', 't3', 'saved', 14),
  idea('student-eats', 't4', 'approved', 1),
  idea('student-eats', 't14', 'approved', 9),
  idea('student-eats', 't7', 'waiting', 14),
]
