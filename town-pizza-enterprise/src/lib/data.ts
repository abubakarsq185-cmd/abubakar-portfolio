export type Pizza = {
  name: string
  desc: string
  r: number | null
  m: number | null
  l: number | null
  xl: number | null
  special?: boolean
}

export const pizzas: Pizza[] = [
  { name: 'Chicken Tikka B.B.Q', desc: 'Cheese, marinated chicken BBQ, onion, tasty tomato sauce & green pepper', r: 700, m: 1400, l: 1900, xl: 2400 },
  { name: 'Chicken Fajita', desc: 'Cheese, garlic grilled chicken, smoked veal, green pepper, onion', r: 700, m: 1400, l: 1900, xl: 2400 },
  { name: 'Chicken Supreme', desc: 'Marinated chicken, onion, cheese, green pepper, black olives, tomato, capsicum', r: 700, m: 1400, l: 1900, xl: 2400 },
  { name: 'Tandori Pizza', desc: 'Tandoori special chicken, cheese, green pepper, onion, capsicum, ring of tomato', r: 700, m: 1400, l: 1900, xl: 2400 },
  { name: 'Fajita Sicilian', desc: 'Green pepper, cheese, grilled chicken, smoked veal, special hot sauce, onion', r: 700, m: 1400, l: 1900, xl: 2400 },
  { name: 'Hot-N-Spicy', desc: 'Cheese, hot-n-spicy chicken, onion, capsicum, olive, hot chilly & tomato', r: 700, m: 1400, l: 1900, xl: 2400 },
  { name: 'Grilled Pizza', desc: 'Roast chicken, black olives, bell pepper & cheese, tomato sauce', r: 700, m: 1400, l: 1900, xl: 2400 },
  { name: 'Chicken Achar Special', desc: 'Cheese, chicken, capsicum, onion, sweet corn, achar special', r: 700, m: 1400, l: 1900, xl: 2400 },
  { name: 'Town Pizza Special', desc: 'Cheese, special chicken, black olives, mushroom, tomato, Italian sauce, onion, capsicum', r: 750, m: 1500, l: 2100, xl: 2600, special: true },
  { name: 'Sausages Pizza', desc: 'Cheese, onion, Italian sausages, mushroom, capsicum, olive, hot chilly & tomato', r: 700, m: 1400, l: 1900, xl: 2400 },
  { name: 'Fruit Pizza', desc: 'Cheese, chicken, pineapple, cherry, capsicum, tasty tomato sauce', r: 700, m: 1400, l: 1900, xl: 2400 },
  { name: 'Pepperoni Hut', desc: 'Cheese, Italian sausages, mushroom, pepperoni topping, tomato sauce', r: 700, m: 1400, l: 1900, xl: 2400 },
  { name: 'Cheese Gold Pizza', desc: 'Cheese, black olives, sausages, capsicum, tomato sauce', r: 700, m: 1400, l: 1900, xl: 2400 },
  { name: 'Chicken Lover', desc: 'Lot of chicken, cheese, capsicum, grilled chicken, special tomato sauce, onion', r: 700, m: 1400, l: 1900, xl: 2400 },
  { name: 'Vegetarian Pizza', desc: 'Cheese, onion, hot chille, ring of bell pepper, green pepper, olives, mushroom, tomato', r: 700, m: 1400, l: 1900, xl: 2400 },
  { name: 'Mushroom Pizza', desc: 'Chicken, onion, tasty tomato sauce, cheese & lot of mushroom', r: 700, m: 1400, l: 1900, xl: 2400 },
]

export const specials: Pizza[] = [
  { name: 'Town Special Double Crust', desc: 'Special mayo sauce, cheese, chicken, black olive, mushroom, tomato, Italian sauce, onion, capsicum', r: null, m: 1900, l: 2200, xl: 2800 },
  { name: 'Stuffed Crust Pizza', desc: 'Special cheese, mayo sauce, chicken, black olive, mushroom, tomato, sauce, onion, capsicum', r: null, m: 1900, l: 2200, xl: 2700 },
  { name: 'Special Afghani Pizza', desc: 'Lots of cheese, black olives, chicken afghani topping, tomato, onion', r: 800, m: 1600, l: 2100, xl: 2600 },
  { name: 'Calzone Pizza', desc: 'Crust filled with cheese, marinated chicken, BBQ chicken, onion, tomato sauce & green pepper', r: null, m: 1600, l: 1900, xl: 2200 },
  { name: 'Paratha Pizza', desc: 'Cheese, special chicken, black olives, mushroom, tomato, Italian sauce, tomato sauce', r: 750, m: null, l: null, xl: null },
]

export type Item = [string, number]
export const burgers: Item[] = [['Zinger Burger', 450], ['Zinger with Cheese Burger', 500], ['Chicken Burger', 400], ['American Burger', 400], ['Tikka Burger', 400], ['Tower Burger', 600], ['Double Decker Burger', 700], ['Town Special Pizza Burger', 650]]
export const chicken: Item[] = [['1 Piece (Leg)', 250], ['1 Piece Chicken (Thai/Chest)', 270], ['8 Piece Full Broast', 2000], ['4 Piece Half Broast', 1050], ['10 Piece Hot Wings', 600], ['5 Piece Hot Wings', 300], ['10 Piece Nuggets', 600], ['10 Piece BBQ Wings', 600], ['10 Piece Buffalo Wings', 750]]
export const shawarma: Item[] = [['Chicken Shawarma', 250], ['Chicken Cheese Shawarma', 300], ['Vegetarian Shawarma', 200], ['Zinger Shawarma', 450], ['Pratha Roll', 350], ['Zinger Pratha Roll', 450]]

export type ListEntry = { cat: string } | Item
export const sides: ListEntry[] = [
  { cat: 'Rice' }, ['Town Special Rice', 450], ['Chicken Fried Rice', 400], ['Egg Fried Rice', 350], ['Vegetarian Rice', 350], ['Chow Mein', 600],
  { cat: 'Soups' }, ['Town Special Soup', 600], ['Hot Sour Soup', 500], ['Chicken Corn Soup', 500], ['Vegetarian Soup', 450],
  { cat: 'Fries' }, ['Small Fries', 200], ['Medium Fries', 300], ['Large Fries', 600],
  { cat: 'Mix Fruit Salad' }, ['Small', 250], ['Medium', 300], ['Large', 400],
]
export const drinks: ListEntry[] = [
  { cat: 'Drinks' }, ['Tin Cane', 110], ['500 ml Drink', 110], ['Sting Cane', 110], ['500 ml Sting', 130], ['1 Ltr Drink', 160], ['1.5 Ltr Drink', 200], ['2.25 Ltr Drink', 260], ['Mineral Water 500 ml', 50], ['Mineral Water 1.5 Ltr', 100],
  { cat: 'Ice Cream (1 Scoop)' }, ['Mango', 60], ['Vanilla', 60], ['Strawberry', 60], ['Chocolate', 60], ['Pista', 60],
]

export type Deal = { b: string; t: string; p: number; items: string[] }
export const deals: Deal[] = [
  { b: 'Super Deal 1', t: '3 Small Pizza', p: 2050, items: ['3 Small Pizza (Chicken Tikka BBQ)', '1 Ltr Cold Drink Free'] },
  { b: 'Super Deal 2', t: '3 Medium Pizza', p: 4000, items: ['3 Medium Pizza (Chicken Tikka BBQ)', '1.5 Ltr Cold Drink Free'] },
  { b: 'Super Deal 3', t: '3 Large Pizza', p: 5500, items: ['3 Large Pizza (Chicken Tikka BBQ)', '1 Jumbo Cold Drink Free'] },
  { b: 'Super Deal 4', t: '3 Extra Large Pizza', p: 7000, items: ['3 Extra Large Pizza (Chicken Tikka BBQ)', '1 Jumbo Cold Drink Free'] },
  { b: 'Family Deal 1', t: 'Family Feast', p: 4200, items: ['2 Chicken Tikka Pizza (S)', '4 Zinger Burgers', '4 Pieces Chicken', '1.5 Ltr Cold Drink'] },
  { b: 'Family Deal 2', t: 'Family Feast', p: 5700, items: ['2 Town Large Special Pizza', '4 Chicken Burger', '1.5 Ltr Cold Drink'] },
  { b: 'Town Supreme Deal', t: 'The Big One', p: 6500, items: ['1 Extra Large Pizza', '2 Zinger Burgers', '10 Hot Wings', '10 Nuggets', '2 Chicken Piece', '2 Chicken Shawarmas', '1 Large Fries', '1 Chicken Fried Rice', '1 Large Salad', '1 Jumbo Drink'] },
  { b: 'Town Special Deal 1', t: 'Special Combo', p: 2900, items: ['2 Small Pizza (Chicken Tikka BBQ)', '2 Zinger Burger', '10 Hot Wings', '1 Ltr Drink'] },
  { b: 'Town Special Deal 2', t: 'Special Combo', p: 3900, items: ['1 Large Pizza (Chicken Tikka BBQ)', '10 Hot Wings', '2 Chicken Piece', '2 Zinger Burger', '1 Jumbo Drink'] },
  { b: 'Town Special Deal 3', t: 'Special Combo', p: 4000, items: ['2 Medium Pizza (Chicken Tikka BBQ)', '2 Tikka Burger', '2 Chicken Shawarma', '1 Ltr Drink'] },
  { b: 'Burger Deal 1', t: 'Burger Combo', p: 1200, items: ['2 Zinger Burger', '1 Medium French Fries', '1 500ml Drink'] },
  { b: 'Burger Deal 2', t: 'Burger Combo', p: 1600, items: ['2 Chicken Burger', '2 Chicken Piece Thai', '1 Medium French Fries', '1 500ml Drink'] },
  { b: 'Burger Deal 3', t: 'Burger Combo', p: 1900, items: ['2 Tikka Burger', '2 Chicken Burger', '1 Medium French Fries', '1 500ml Drink'] },
  { b: 'Burger Deal 4', t: 'Burger Combo', p: 1740, items: ['2 Zinger Burger', '2 Chicken Piece Thai', '1 Medium French Fries', '1 500ml Drink'] },
  { b: 'Burger Deal 5', t: 'Burger Combo', p: 2100, items: ['2 Tower Burger', '1 Medium French Fries', '1 500ml Drink', '10 Hot Wings'] },
  { b: 'Burger Deal 6', t: 'Burger Combo', p: 2000, items: ['2 Double Decker Burger', '2 Medium French Fries', '1 Ltr Drink'] },
  { b: 'Burger Deal 7', t: 'Chicken Combo', p: 2760, items: ['8 Chicken Piece', '1 Large French Fries', '1 1.5 Ltr Drink'] },
  { b: 'Burger Deal 8', t: 'Party Combo', p: 5500, items: ['6 Zinger Burger', '6 Chicken Piece', '10 Hot Wings', '1 Large Fries', '1 1.5 Ltr Drink'] },
  { b: 'Burger Deal 9', t: 'Party Combo', p: 5800, items: ['8 Chicken Burger', '8 Chicken Piece', '1 Large Fries', '1 1.5 Ltr Drink'] },
]

export type Branch = { n: string; addr: string; phones: string[]; wa: string; isNew?: boolean }
export const branches: Branch[] = [
  { n: 'Branch 1', addr: 'Kabal Road, Township Chowk, Naimat Plaza', phones: ['03189659090', '03449659090', '03469659090'], wa: '923189659090' },
  { n: 'Branch 2', addr: 'Khwaza Khela Bazar, Near Secondary School, Hashmat Plaza', phones: ['03149619090', '03469619090', '0946744200'], wa: '923149619090' },
  { n: 'Branch 3', addr: 'Main Sersanai Chowk, 2nd Floor, Deolai Road', phones: ['03199629090', '03469629090', '03479629090', '03143079593'], wa: '923199629090' },
  { n: 'Branch 4', addr: 'Ningolai, Chota Kalam', phones: ['03289659090', '03419659090', '03429659090'], wa: '923289659090' },
  { n: 'Branch 5', addr: 'Bagh Dherai Road, Khwaza Khela Chowk, Khirabad, Near Wakeel Shopping Center', phones: ['03409619090', '03419619090'], wa: '923409619090', isNew: true },
]

export const testimonials = [
  { q: "The Town Pizza Special is the best pizza in Swat — hot, loaded and fresh every time.", n: 'Bilal A.', r: 5 },
  { q: 'Fast free delivery and the cheese is always real and generous. Family favourite!', n: 'Sana K.', r: 5 },
  { q: 'Booked the free birthday hall and ordered the party deal — everyone loved it.', n: 'Imran U.', r: 5 },
  { q: 'Zinger burgers and hot wings are unreal. Quality never drops across branches.', n: 'Hassan R.', r: 5 },
]

export const faqs = [
  { q: 'Do you offer free home delivery?', a: 'Yes — free delivery within 5 km on orders above Rs 1000. Beyond 5 km a small charge may apply.' },
  { q: 'What are your opening hours?', a: 'All branches are open daily from 10:00 AM to 11:45 PM.' },
  { q: 'Can I book the birthday party hall?', a: 'Yes. Book any party deal and the hall charges are completely free.' },
  { q: 'How do I place an order?', a: 'Tap any "Order on WhatsApp" button, or call your nearest branch directly from the Locations section.' },
  { q: 'Do you have vegetarian options?', a: 'Yes — Vegetarian Pizza, Vegetarian Shawarma, Vegetarian Rice and Vegetarian Soup are all on the menu.' },
]

export const RESTAURANT = {
  name: 'Town Pizza Hut',
  tagline: 'The Name of Quality',
  city: 'Swat, Pakistan',
  wa: '923189659090',
  hours: '10:00 AM – 11:45 PM',
  url: 'https://townpizzahut.example',
}
