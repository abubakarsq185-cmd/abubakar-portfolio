/**
 * Town Pizza Hut — single source of truth for all menu content.
 *
 * Transcribed directly from the official printed menu. All prices are in PKR.
 * Pizza sizes: R 7" · M 11" · L 13" · EL 16".
 */

/* ---------------- Pizza Deals (Super Deals) ---------------- */
export const pizzaDeals = [
  {
    name: 'Super Deal 1',
    tag: 'Small',
    price: 2050,
    items: ['3 Small Pizza (Chicken Tikka BBQ)', '1 × 1 Ltr Cold Drink — Free'],
  },
  {
    name: 'Super Deal 2',
    tag: 'Medium',
    price: 4000,
    items: ['3 Medium Pizza (Chicken Tikka BBQ)', '1 × 1.5 Ltr Cold Drink — Free'],
  },
  {
    name: 'Super Deal 3',
    tag: 'Large',
    price: 5500,
    items: ['3 Large Pizza (Chicken Tikka BBQ)', '1 Jumbo Cold Drink — Free'],
  },
  {
    name: 'Super Deal 4',
    tag: 'Extra Large',
    price: 7000,
    items: ['3 Extra Large Pizza (Chicken Tikka BBQ)', '1 Jumbo Cold Drink — Free'],
  },
]

/* ---------------- Family Deals ---------------- */
export const familyDeals = [
  {
    name: 'Family Deal 1',
    price: 4200,
    items: [
      '2 Chicken Tikka Pizza (Small)',
      '4 Zinger Burgers',
      '4 Pieces Chicken',
      '1 × 1.5 Ltr Cold Drink',
    ],
  },
  {
    name: 'Family Deal 2',
    price: 5700,
    items: ['2 Town Large Special Pizza', '4 Chicken Burger', '1 × 1.5 Ltr Cold Drink'],
  },
]

/* ---------------- Town Supreme Deal (flagship combo) ---------------- */
export const townSupremeDeal = {
  name: 'Town Supreme Deal',
  price: 6500,
  items: [
    '1 Extra Large Pizza',
    '2 Zinger Burgers',
    '10 Hot Wings',
    '10 Nuggets',
    '2 Chicken Piece',
    '2 Chicken Shawarmas',
    '1 Large Fries',
    '1 Chicken Fried Rice',
    '1 Large Salad',
    '1 Jumbo Drink',
  ],
}

/* ---------------- Town Special Deals ---------------- */
export const specialDeals = [
  {
    name: 'Deal 1',
    price: 2900,
    items: [
      '2 Small Pizza (Chicken Tikka BBQ)',
      '2 Zinger Burger',
      '10 Hot Wings',
      '1 × 1 Ltr Drink',
    ],
  },
  {
    name: 'Deal 2',
    price: 3900,
    items: [
      '1 Large Pizza (Chicken Tikka BBQ)',
      '10 Hot Wings',
      '2 Chicken Piece',
      '2 Zinger Burger',
      '1 Jumbo Drink',
    ],
  },
  {
    name: 'Deal 3',
    price: 4000,
    items: [
      '2 Medium Pizza (Chicken Tikka BBQ)',
      '2 Tikka Burger',
      '2 Chicken Shawarma',
      '1 × 1 Ltr Drink',
    ],
  },
]

/* ---------------- Pizzas (R 7" · M 11" · L 13" · EL 16") ---------------- */
const STD = { R: 700, M: 1400, L: 1900, EL: 2400 }

export const pizzas = [
  {
    name: 'Chicken Tikka B.B.Q',
    category: 'chicken',
    desc: 'Cheese, marinated BBQ chicken, onion, tasty tomato sauce & green pepper.',
    size: STD,
    hot: true,
  },
  {
    name: 'Chicken Fajita',
    category: 'chicken',
    desc: 'Cheese, garlic grilled chicken, smoked veal, green pepper & onion.',
    size: STD,
  },
  {
    name: 'Chicken Supreme',
    category: 'chicken',
    desc: 'Marinated chicken, onion, special cheese, green pepper, black olives, tomato & capsicum.',
    size: STD,
  },
  {
    name: 'Tandori Pizza',
    category: 'chicken',
    desc: 'Tandoori special chicken, cheese, green pepper, onion, capsicum & ring of tomato.',
    size: STD,
  },
  {
    name: 'Fajita Sicilian',
    category: 'chicken',
    desc: 'Green pepper, cheese, grilled chicken, smoked veal, special hot sauce & onion.',
    size: STD,
  },
  {
    name: 'Hot-N-Spicy',
    category: 'chicken',
    desc: 'Cheese, hot-n-spicy chicken, onion, capsicum, olive, hot chilli & tomato.',
    size: STD,
  },
  {
    name: 'Grilled Pizza',
    category: 'chicken',
    desc: 'Roast chicken, black olives, bell pepper, cheese & tomato sauce.',
    size: STD,
  },
  {
    name: 'Chicken Achar Special',
    category: 'chicken',
    desc: 'Cheese, chicken, capsicum, onion, sweet corn & achar special.',
    size: STD,
  },
  {
    name: 'Town Pizza Special',
    category: 'special',
    desc: 'Cheese, special chicken, black olives, mushroom, tomato, Italian & tasty tomato sauce, onion, capsicum.',
    size: { R: 750, M: 1500, L: 2100, EL: 2600 },
    hot: true,
  },
  {
    name: 'Sausages Pizza',
    category: 'special',
    desc: 'Cheese, onion, Italian sausages, mushroom, capsicum, olive, hot chilli & tomato.',
    size: STD,
  },
  {
    name: 'Fruit Pizza',
    category: 'special',
    desc: 'Cheese, chicken, pineapple, cherry, capsicum & tasty tomato sauce.',
    size: STD,
  },
  {
    name: 'Pepperoni Hut',
    category: 'special',
    desc: 'Cheese, Italian sausages, mushroom, pepperoni & tasty tomato sauce.',
    size: STD,
  },
  {
    name: 'Cheese Gold Pizza',
    category: 'special',
    desc: 'Cheese, black olives, sausages, capsicum & tomato sauce.',
    size: STD,
  },
  {
    name: 'Chicken Lover',
    category: 'chicken',
    desc: 'Lots of chicken, cheese, capsicum, grilled chicken, special tomato sauce & onion.',
    size: STD,
  },
  {
    name: 'Vegetarian Pizza',
    category: 'veg',
    desc: 'Cheese, onion, hot chilli, ring of bell pepper, green pepper, olives, mushroom & tomato.',
    size: STD,
  },
  {
    name: 'Mushroom Pizza',
    category: 'chicken',
    desc: 'Chicken, onion, tasty tomato sauce, cheese & lots of mushroom.',
    size: STD,
  },
]

/* ---------------- New Special Flavours (partial sizes offered) ---------------- */
export const specialFlavours = [
  {
    name: 'Town Special Double Crust',
    desc: 'Special mayo sauce, cheese, special chicken, black olives, mushroom, tomato, Italian & tomato sauce, onion, capsicum.',
    size: { M: 1900, L: 2200, EL: 2800 },
    hot: true,
  },
  {
    name: 'Stuffed Crust Pizza',
    desc: 'Special cheese & mayo sauce, cheese, special chicken, black olives, mushroom, tomato, Italian & tomato sauce, onion, capsicum.',
    size: { M: 1900, L: 2200, EL: 2700 },
  },
  {
    name: 'Special Afghani Pizza',
    desc: 'Lots of cheese, black olives, chicken Afghani topping, tomato & onion.',
    size: { R: 800, M: 1600, L: 2100, EL: 2600 },
  },
  {
    name: 'Calzone Pizza',
    desc: 'Crust filled with cheese, marinated chicken, BBQ chicken, onion, tasty tomato sauce & green pepper.',
    size: { M: 1600, L: 1900, EL: 2200 },
  },
  {
    name: 'Paratha Pizza',
    desc: 'Cheese, special chicken, black olives, mushroom, tomato, Italian & tasty tomato sauce.',
    size: { R: 750 },
  },
]

export const extraTopping = { R: 150, M: 200, L: 250, EL: 350 }

/* ---------------- Burgers · Fried Chicken · Shawarmas ---------------- */
export const burgers = [
  { name: 'Zinger Burger', price: 450 },
  { name: 'Zinger with Cheese Burger', price: 500 },
  { name: 'Chicken Burger', price: 400 },
  { name: 'American Burger', price: 400 },
  { name: 'Tikka Burger', price: 400 },
  { name: 'Tower Burger', price: 600 },
  { name: 'Double Decker Burger', price: 700 },
  { name: 'Town Special Pizza Burger', price: 650 },
]

export const friedChicken = [
  { name: '1 Piece (Leg)', price: 250 },
  { name: '1 Piece Chicken (Thai / Chest)', price: 270 },
  { name: '8 Piece Full Broast', price: 2000 },
  { name: '4 Piece Half Broast', price: 1050 },
  { name: '10 Piece Hot Wings', price: 600 },
  { name: '5 Piece Hot Wings', price: 300 },
  { name: '10 Piece Nuggets', price: 600 },
  { name: '10 Piece BBQ Wings', price: 600 },
  { name: '10 Piece Buffalo Wings', price: 750 },
]

export const shawarmas = [
  { name: 'Chicken Shawarma', price: 250 },
  { name: 'Chicken Cheese Shawarma', price: 300 },
  { name: 'Vegetarian Shawarma', price: 200 },
  { name: 'Zinger Shawarma', price: 450 },
  { name: 'Pratha Roll', price: 350 },
  { name: 'Zinger Pratha Roll', price: 450 },
]

/* ---------------- Burger Deals ---------------- */
export const burgerDeals = [
  { name: 'Deal 1', price: 1200, items: ['2 Zinger Burger', '1 Medium French Fries', '1 × 500 ml Drink'] },
  {
    name: 'Deal 2',
    price: 1600,
    items: ['2 Chicken Burger', '2 Chicken Piece (Thai)', '1 Medium French Fries', '1 × 500 ml Drink'],
  },
  {
    name: 'Deal 3',
    price: 1900,
    items: ['2 Tikka Burger', '2 Chicken Burger', '1 Medium French Fries', '1 × 500 ml Drink'],
  },
  {
    name: 'Deal 4',
    price: 1740,
    items: ['2 Zinger Burger', '2 Chicken Piece (Thai)', '1 Medium French Fries', '1 × 500 ml Drink'],
  },
  {
    name: 'Deal 5',
    price: 2100,
    items: ['2 Tower Burger', '1 Medium French Fries', '1 × 500 ml Drink', '10 Hot Wings'],
  },
  { name: 'Deal 6', price: 2000, items: ['2 Double Decker Burger', '2 Medium French Fries', '1 Ltr Drink'] },
  { name: 'Deal 7', price: 2760, items: ['8 Chicken Piece', '1 Large French Fries', '1 × 1.5 Ltr Drink'] },
  {
    name: 'Deal 8',
    price: 5500,
    items: ['6 Zinger Burger', '6 Chicken Piece', '10 Hot Wings', '1 Large Fries', '1 × 1.5 Ltr Drink'],
  },
  {
    name: 'Deal 9',
    price: 5800,
    items: ['8 Chicken Burger', '8 Chicken Piece', '1 Large Fries', '1 × 1.5 Ltr Drink'],
  },
]

/* ---------------- Special Items ---------------- */
export const specialItems = [
  {
    title: 'Rice & Noodles',
    items: [
      { name: 'Town Special Rice', price: 450 },
      { name: 'Chicken Fried Rice', price: 400 },
      { name: 'Egg Fried Rice', price: 350 },
      { name: 'Vegetarian Rice', price: 350 },
      { name: 'Chow Mein', price: 600 },
    ],
  },
  {
    title: 'Soups',
    items: [
      { name: 'Town Special Soup', price: 600 },
      { name: 'Hot & Sour Soup', price: 500 },
      { name: 'Chicken Corn Soup', price: 500 },
      { name: 'Vegetarian Soup', price: 450 },
    ],
  },
  {
    title: 'Fries & Salad',
    items: [
      { name: 'Small Fries', price: 200 },
      { name: 'Medium Fries', price: 300 },
      { name: 'Large Fries', price: 600 },
      { name: 'Mix Fruit Salad (S / M / L)', price: '250 / 300 / 400' },
    ],
  },
  {
    title: 'Cold Drinks',
    items: [
      { name: 'Tin Can', price: 110 },
      { name: '500 ml Drink', price: 110 },
      { name: 'Sting Can', price: 110 },
      { name: '500 ml Sting', price: 130 },
      { name: '1 Ltr Drink', price: 160 },
      { name: '1.5 Ltr Drink', price: 200 },
      { name: '2.25 Ltr Drink', price: 260 },
      { name: 'Mineral Water 500 ml', price: 50 },
      { name: 'Mineral Water 1.5 Ltr', price: 100 },
    ],
  },
  {
    title: 'Ice Cream (1 Scoop)',
    items: [
      { name: 'Mango', price: 60 },
      { name: 'Vanilla', price: 60 },
      { name: 'Strawberry', price: 60 },
      { name: 'Chocolate', price: 60 },
      { name: 'Pista', price: 60 },
    ],
  },
]

/* ---------------- Branches ---------------- */
export const branches = [
  {
    name: 'Branch 1',
    area: 'Kabal Road, Township Chowk, Naimat Plaza',
    phones: ['0318-9659090', '0344-9659090', '0346-9659090'],
  },
  {
    name: 'Branch 2',
    area: 'Khwaza Khela Bazar, Near Secondary School, Hashmat Plaza',
    phones: ['0314-9619090', '0346-9619090', '0946-744200'],
  },
  {
    name: 'Branch 3',
    area: 'Main Sersanai Chowk, 2nd Floor, Deolai Road',
    phones: ['0319-9629090', '0346-9629090', '0347-9629090', '0314-3079593'],
  },
  {
    name: 'Branch 4',
    area: 'Ningolai, Chota Kalam',
    phones: ['0328-9659090', '0341-9659090', '0342-9659090'],
  },
  {
    name: 'Branch 5',
    area: 'Bagh Dherai Road, Khawaza Khela Chowk, Khirabad, Near Wakeel Shopping Center',
    phones: ['0340-9619090', '0341-9619090'],
    isNew: true,
  },
]
