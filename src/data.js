/**
 * Town Pizza Hut — single source of truth for all menu content.
 *
 * Every price is in PKR. Edit this file to update the live website; the
 * rendering layer (render.js) reads these arrays and builds the DOM.
 * Sizes reference: R 7" · M 11" · L 13" · EL 16".
 */

export const pizzaDeals = [
  {
    name: 'Deal 1',
    tag: 'Most loved',
    price: 1550,
    items: ['1 Medium Pizza', '1 Regular Pizza', '1 × 345ml Drink'],
  },
  {
    name: 'Deal 2',
    tag: 'Sharing',
    price: 2450,
    items: ['2 Large Pizzas', '1 × 1.5 Ltr Drink'],
  },
  {
    name: 'Deal 3',
    tag: 'Party starter',
    price: 3350,
    items: ['3 Large Pizzas', '1 × 1.5 Ltr Drink', 'Free Garlic Dip'],
  },
]

export const familyDeals = [
  {
    name: 'Family Feast A',
    price: 2950,
    items: ['2 Large Pizzas', '5 Hot Wings', '1 Ltr Drink'],
  },
  {
    name: 'Family Feast B',
    price: 3950,
    items: ['2 Large Pizzas', '2 Zinger Burgers', '10 Nuggets', '1.5 Ltr Drink'],
  },
  {
    name: 'Family Feast C',
    price: 5250,
    items: ['3 Large Pizzas', '1 Large Fries', '10 Hot Wings', '2 × 1.5 Ltr Drinks'],
  },
]

export const specialDeals = [
  {
    name: 'Town Special 1',
    price: 1990,
    items: ['1 Large Pizza', '1 Zinger Burger', '1 × 345ml Drink'],
  },
  {
    name: 'Town Special 2',
    price: 2790,
    items: ['1 Extra Large Pizza', '2 Pcs Fried Chicken', '1 × 500ml Drink'],
  },
  {
    name: 'Town Special 3',
    price: 3490,
    items: ['1 Extra Large Pizza', '5 Hot Wings', 'Garlic Bread', '1 Ltr Drink'],
  },
]

/** Flagship pizzas. size = {R, M, L, EL} in PKR. */
export const pizzas = [
  {
    name: 'Chicken Tikka BBQ',
    category: 'chicken',
    desc: 'Signature smoky tikka, BBQ drizzle, onions & fresh capsicum.',
    size: { R: 700, M: 1400, L: 1900, EL: 2400 },
    hot: true,
  },
  {
    name: 'Chicken Fajita',
    category: 'chicken',
    desc: 'Marinated chicken, peppers, onion and a mozzarella blanket.',
    size: { R: 700, M: 1400, L: 1900, EL: 2400 },
  },
  {
    name: 'Chicken Supreme',
    category: 'chicken',
    desc: 'Loaded chicken, sausage, olives and double cheese.',
    size: { R: 750, M: 1450, L: 1950, EL: 2500 },
  },
  {
    name: 'Crown Crust Special',
    category: 'special',
    desc: 'Cheese-stuffed crown crust with a full tikka topping.',
    size: { R: 900, M: 1650, L: 2200, EL: 2800 },
    hot: true,
  },
  {
    name: 'Behari Kabab',
    category: 'special',
    desc: 'Spiced behari kabab, green chilli and coriander finish.',
    size: { R: 800, M: 1500, L: 2000, EL: 2550 },
  },
  {
    name: 'Cheese Lovers',
    category: 'veg',
    desc: 'Four-cheese melt on our slow-proofed hand-tossed base.',
    size: { R: 700, M: 1350, L: 1850, EL: 2350 },
  },
  {
    name: 'Veggie Garden',
    category: 'veg',
    desc: 'Mushroom, olives, sweet corn, capsicum and onion.',
    size: { R: 650, M: 1300, L: 1800, EL: 2300 },
  },
  {
    name: 'Malai Boti',
    category: 'chicken',
    desc: 'Creamy malai boti, mint drizzle and roasted garlic.',
    size: { R: 800, M: 1500, L: 2000, EL: 2550 },
  },
]

/** Premium, hero-treatment pizzas shown as wide feature cards. */
export const premiumPizzas = [
  {
    name: 'The Town Royale',
    price: 2900,
    desc: 'Double tikka, malai boti, crown crust and a smoked-cheese pull. Our chef’s statement piece.',
  },
  {
    name: 'Fire BBQ Feast',
    price: 2600,
    desc: 'Flame-charred BBQ chicken, jalapeño, caramelised onion and a honey-chilli glaze.',
  },
]

/** Side menus rendered as two split columns. */
export const sideMenus = [
  {
    title: 'Burgers',
    items: [
      { name: 'Zinger Burger', price: 450 },
      { name: 'Chicken Patty Burger', price: 380 },
      { name: 'Town Tower Burger', price: 650 },
      { name: 'Grilled Cheese Burger', price: 520 },
    ],
  },
  {
    title: 'Fried Chicken & Wraps',
    items: [
      { name: 'Fried Chicken (2 Pcs)', price: 520 },
      { name: 'Hot Wings (5 Pcs)', price: 480 },
      { name: 'Chicken Shawarma', price: 300 },
      { name: 'Special Platter Shawarma', price: 550 },
    ],
  },
]

export const burgerDeals = [
  {
    name: 'Burger Deal 1',
    price: 850,
    items: ['2 Zinger Burgers', '1 × 345ml Drink'],
  },
  {
    name: 'Burger Deal 2',
    price: 1250,
    items: ['2 Zinger Burgers', '1 Regular Fries', '2 × 345ml Drinks'],
  },
  {
    name: 'Burger Deal 3',
    price: 1650,
    items: ['3 Town Tower Burgers', '1 Large Fries', '1.5 Ltr Drink'],
  },
]

export const sides = [
  { name: 'Regular Fries', price: 250, kind: 'Fries' },
  { name: 'Loaded Cheese Fries', price: 450, kind: 'Fries' },
  { name: 'Chicken Corn Soup', price: 320, kind: 'Soup' },
  { name: 'Hot & Sour Soup', price: 340, kind: 'Soup' },
  { name: 'Arabic Rice', price: 480, kind: 'Rice' },
  { name: 'Chicken Biryani', price: 400, kind: 'Rice' },
  { name: '345 ml Drink', price: 90, kind: 'Drink' },
  { name: '1.5 Ltr Drink', price: 220, kind: 'Drink' },
]

export const branches = [
  { name: 'Branch 1 — Main Boulevard', phone: '03189659090', whatsapp: '923189659090' },
  { name: 'Branch 2 — College Road', phone: '03189659091', whatsapp: '923189659091' },
  { name: 'Branch 3 — Model Town', phone: '03189659092', whatsapp: '923189659092' },
  { name: 'Branch 4 — Saddar', phone: '03189659093', whatsapp: '923189659093' },
  { name: 'Branch 5 — Cantt', phone: '03189659094', whatsapp: '923189659094' },
]
