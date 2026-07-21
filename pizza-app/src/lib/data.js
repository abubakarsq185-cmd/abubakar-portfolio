export const pizzas = [
  ['Chicken Tikka B.B.Q', 'Cheese, marinated chicken BBQ, onion, tasty tomato sauce & green pepper', 700, 1400, 1900, 2400],
  ['Chicken Fajita', 'Cheese, garlic grilled chicken, smoked veal, green pepper, onion', 700, 1400, 1900, 2400],
  ['Chicken Supreme', 'Marinated chicken, onion, cheese, green pepper, black olives, tomato, capsicum', 700, 1400, 1900, 2400],
  ['Tandori Pizza', 'Tandoori special chicken, cheese, green pepper, onion, capsicum, ring of tomato', 700, 1400, 1900, 2400],
  ['Fajita Sicilian', 'Green pepper, cheese, grilled chicken, smoked veal, special hot sauce, onion', 700, 1400, 1900, 2400],
  ['Hot-N-Spicy', 'Cheese, hot-n-spicy chicken, onion, capsicum, olive, hot chilly & tomato', 700, 1400, 1900, 2400],
  ['Grilled Pizza', 'Roast chicken, black olives, bell pepper & cheese, tomato sauce', 700, 1400, 1900, 2400],
  ['Chicken Achar Special', 'Cheese, chicken, capsicum, onion, sweet corn, achar special', 700, 1400, 1900, 2400],
  ['Town Pizza Special', 'Cheese, special chicken, black olives, mushroom, tomato, Italian sauce, onion, capsicum', 750, 1500, 2100, 2600, true],
  ['Sausages Pizza', 'Cheese, onion, Italian sausages, mushroom, capsicum, olive, hot chilly & tomato', 700, 1400, 1900, 2400],
  ['Fruit Pizza', 'Cheese, chicken, pineapple, cherry, capsicum, tasty tomato sauce', 700, 1400, 1900, 2400],
  ['Pepperoni Hut', 'Cheese, Italian sausages, mushroom, pepperoni topping, tomato sauce', 700, 1400, 1900, 2400],
  ['Cheese Gold Pizza', 'Cheese, black olives, sausages, capsicum, tomato sauce', 700, 1400, 1900, 2400],
  ['Chicken Lover', 'Lot of chicken, cheese, capsicum, grilled chicken, special tomato sauce, onion', 700, 1400, 1900, 2400],
  ['Vegetarian Pizza', 'Cheese, onion, hot chille, ring of bell pepper, green pepper, olives, mushroom, tomato', 700, 1400, 1900, 2400],
  ['Mushroom Pizza', 'Chicken, onion, tasty tomato sauce, cheese & lot of mushroom', 700, 1400, 1900, 2400],
]

export const specials = [
  ['Town Special Double Crust', 'Special mayo sauce, cheese, chicken, black olive, mushroom, tomato, Italian sauce, onion, capsicum', null, 1900, 2200, 2800],
  ['Stuffed Crust Pizza', 'Special cheese, mayo sauce, chicken, black olive, mushroom, tomato, sauce, onion, capsicum', null, 1900, 2200, 2700],
  ['Special Afghani Pizza', 'Lots of cheese, black olives, chicken afghani topping, tomato, onion', 800, 1600, 2100, 2600],
  ['Calzone Pizza', 'Crust filled with cheese, marinated chicken, BBQ chicken, onion, tomato sauce & green pepper', null, 1600, 1900, 2200],
  ['Paratha Pizza', 'Cheese, special chicken, black olives, mushroom, tomato, Italian sauce, tomato sauce', 750, null, null, null],
]

export const burgers = [['Zinger Burger', 450], ['Zinger with Cheese Burger', 500], ['Chicken Burger', 400], ['American Burger', 400], ['Tikka Burger', 400], ['Tower Burger', 600], ['Double Decker Burger', 700], ['Town Special Pizza Burger', 650]]
export const chicken = [['1 Piece (Leg)', 250], ['1 Piece Chicken (Thai/Chest)', 270], ['8 Piece Full Broast', 2000], ['4 Piece Half Broast', 1050], ['10 Piece Hot Wings', 600], ['5 Piece Hot Wings', 300], ['10 Piece Nuggets', 600], ['10 Piece BBQ Wings', 600], ['10 Piece Buffalo Wings', 750]]
export const shawarma = [['Chicken Shawarma', 250], ['Chicken Cheese Shawarma', 300], ['Vegetarian Shawarma', 200], ['Zinger Shawarma', 450], ['Pratha Roll', 350], ['Zinger Pratha Roll', 450]]
export const sides = [
  { cat: 'Rice' }, ['Town Special Rice', 450], ['Chicken Fried Rice', 400], ['Egg Fried Rice', 350], ['Vegetarian Rice', 350], ['Chow Mein', 600],
  { cat: 'Soups' }, ['Town Special Soup', 600], ['Hot Sour Soup', 500], ['Chicken Corn Soup', 500], ['Vegetarian Soup', 450],
  { cat: 'Fries' }, ['Small Fries', 200], ['Medium Fries', 300], ['Large Fries', 600],
  { cat: 'Mix Fruit Salad' }, ['Small', 250], ['Medium', 300], ['Large', 400],
]
export const drinks = [
  { cat: 'Drinks' }, ['Tin Cane', 110], ['500 ml Drink', 110], ['Sting Cane', 110], ['500 ml Sting', 130], ['1 Ltr Drink', 160], ['1.5 Ltr Drink', 200], ['2.25 Ltr Drink', 260], ['Mineral Water 500 ml', 50], ['Mineral Water 1.5 Ltr', 100],
  { cat: 'Ice Cream (1 Scoop)' }, ['Mango', 60], ['Vanilla', 60], ['Strawberry', 60], ['Chocolate', 60], ['Pista', 60],
]

export const deals = [
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

export const branches = [
  { n: 'Branch 1', addr: 'Kabal Road, Township Chowk, Naimat Plaza', phones: ['03189659090', '03449659090', '03469659090'], wa: '923189659090' },
  { n: 'Branch 2', addr: 'Khwaza Khela Bazar, Near Secondary School, Hashmat Plaza', phones: ['03149619090', '03469619090', '0946744200'], wa: '923149619090' },
  { n: 'Branch 3', addr: 'Main Sersanai Chowk, 2nd Floor, Deolai Road', phones: ['03199629090', '03469629090', '03479629090', '03143079593'], wa: '923199629090' },
  { n: 'Branch 4', addr: 'Ningolai, Chota Kalam', phones: ['03289659090', '03419659090', '03429659090'], wa: '923289659090' },
  { n: 'Branch 5', addr: 'Bagh Dherai Road, Khwaza Khela Chowk, Khirabad, Near Wakeel Shopping Center', phones: ['03409619090', '03419619090'], wa: '923409619090', isNew: true },
]

export const menuTabs = [
  { id: 'pizzas', label: 'Pizzas', icon: 'Pizza' },
  { id: 'burgers', label: 'Burgers', icon: 'Beef' },
  { id: 'chicken', label: 'Fried Chicken', icon: 'Drumstick' },
  { id: 'shawarma', label: 'Shawarmas', icon: 'Wrap' },
  { id: 'sides', label: 'Rice · Soups · Sides', icon: 'Soup' },
  { id: 'drinks', label: 'Drinks · Ice Cream', icon: 'CupSoda' },
]
