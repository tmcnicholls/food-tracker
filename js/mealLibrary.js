// Bundled meal library — no network calls, no nutritional data.
//
// Every entry is { text, tags }. Tags describe *how* the meal fits into a
// week, not how "good" it is:
//   - effort:    'low' | 'medium' | 'high'      (how much hands-on cooking)
//   - style:     'homemade' | 'convenience'      (broad shorthand used by the
//                 consistency profiles — convenience meals are completely
//                 normal foods, just quicker/shop-bought)
//   - leftoverSource: true  -> this tea commonly reappears as next day's lunch
//   - weekend:   true  -> a good fit for Saturday/Sunday when there's more time
//   - structured: true -> a "planned" style meal, more likely under Great
//   - irregular: true -> a grab-and-go / skipped-structure option, more
//                 likely to appear under Poor. Never implies overeating.
//
// This file is intentionally data-only so the generator stays testable.

export const breakfast = [
  { text: 'Porridge with banana', tags: { effort: 'low', style: 'homemade', structured: true } },
  { text: 'Porridge with mixed berries', tags: { effort: 'low', style: 'homemade', structured: true } },
  { text: 'Weetabix with milk', tags: { effort: 'low', style: 'homemade' } },
  { text: 'Bran flakes with milk and a sliced banana', tags: { effort: 'low', style: 'homemade' } },
  { text: 'Scrambled eggs on wholemeal toast', tags: { effort: 'medium', style: 'homemade', structured: true } },
  { text: 'Boiled eggs and toast', tags: { effort: 'medium', style: 'homemade' } },
  { text: 'Toast with peanut butter', tags: { effort: 'low', style: 'homemade' } },
  { text: 'Toast with a light spread and marmalade', tags: { effort: 'low', style: 'homemade' } },
  { text: 'Greek yoghurt with fruit and granola', tags: { effort: 'low', style: 'homemade', structured: true } },
  { text: 'Overnight oats with honey', tags: { effort: 'low', style: 'homemade', structured: true } },
  { text: 'Crumpets with a light spread', tags: { effort: 'low', style: 'homemade' } },
  { text: 'Bacon roll', tags: { effort: 'medium', style: 'convenience', weekend: true } },
  { text: 'Sausage and egg muffin on the way to work', tags: { effort: 'low', style: 'convenience', irregular: true } },
  { text: 'Coffee and a banana at the desk', tags: { effort: 'low', style: 'convenience', irregular: true } },
  { text: 'Breakfast skipped, just a coffee', tags: { effort: 'low', style: 'convenience', irregular: true } },
  { text: 'Full English breakfast', tags: { effort: 'high', style: 'homemade', weekend: true } },
  { text: 'Pancakes with fruit', tags: { effort: 'medium', style: 'homemade', weekend: true } },
];

export const lunch = [
  { text: 'Chicken salad wrap and an apple', tags: { effort: 'low', style: 'homemade', structured: true } },
  { text: 'Tuna jacket potato with sweetcorn', tags: { effort: 'medium', style: 'homemade', structured: true } },
  { text: 'Ham and cheese sandwich with fruit', tags: { effort: 'low', style: 'homemade' } },
  { text: 'Egg mayonnaise sandwich with salad', tags: { effort: 'low', style: 'homemade' } },
  { text: 'Baked beans on toast', tags: { effort: 'low', style: 'homemade' } },
  { text: 'Soup with wholemeal bread', tags: { effort: 'low', style: 'homemade' } },
  { text: 'Chicken and salad pitta', tags: { effort: 'low', style: 'homemade' } },
  { text: 'Houmous, falafel and salad wrap', tags: { effort: 'low', style: 'homemade' } },
  { text: 'Shop-bought meal deal sandwich and crisps', tags: { effort: 'low', style: 'convenience' } },
  { text: 'Supermarket sushi box', tags: { effort: 'low', style: 'convenience' } },
  { text: 'Microwave ready meal', tags: { effort: 'low', style: 'convenience', irregular: true } },
  { text: 'Service station sandwich, eaten in a rush', tags: { effort: 'low', style: 'convenience', irregular: true } },
  { text: "Beans on toast, eaten standing up", tags: { effort: 'low', style: 'convenience', irregular: true } },
];

// Weekday/weekend "tea" (main evening meal). leftoverSource meals commonly
// get eaten again the next day for lunch.
export const tea = [
  { text: 'Spaghetti bolognese with side salad', tags: { effort: 'medium', style: 'homemade', leftoverSource: true, structured: true } },
  { text: 'Chicken fajitas with peppers', tags: { effort: 'medium', style: 'homemade', structured: true } },
  { text: 'Sausage traybake with potatoes and vegetables', tags: { effort: 'medium', style: 'homemade', structured: true } },
  { text: 'Chicken curry with rice', tags: { effort: 'medium', style: 'homemade', leftoverSource: true } },
  { text: 'Cottage pie with vegetables', tags: { effort: 'high', style: 'homemade', leftoverSource: true } },
  { text: 'Homemade burgers with potato wedges', tags: { effort: 'medium', style: 'homemade' } },
  { text: 'Salmon with new potatoes and greens', tags: { effort: 'medium', style: 'homemade', structured: true } },
  { text: 'Chicken pasta bake', tags: { effort: 'medium', style: 'homemade', leftoverSource: true } },
  { text: 'Stir-fry with rice', tags: { effort: 'low', style: 'homemade', structured: true } },
  { text: 'Stir-fry with noodles', tags: { effort: 'low', style: 'homemade' } },
  { text: 'Chilli con carne with rice', tags: { effort: 'medium', style: 'homemade', leftoverSource: true } },
  { text: 'Roast chicken dinner', tags: { effort: 'high', style: 'homemade', weekend: true, leftoverSource: true } },
  { text: 'Homemade fish pie', tags: { effort: 'high', style: 'homemade', weekend: true } },
  { text: 'Jacket potatoes with cheese and beans', tags: { effort: 'low', style: 'homemade' } },
  { text: 'Breakfast for tea — eggs, beans and toast', tags: { effort: 'low', style: 'homemade' } },
  { text: 'Shop-bought lasagne with garlic bread', tags: { effort: 'low', style: 'convenience' } },
  { text: 'Frozen pizza with a side salad', tags: { effort: 'low', style: 'convenience' } },
  { text: 'Supermarket ready meal curry', tags: { effort: 'low', style: 'convenience', irregular: true } },
  { text: 'Fish and chips from the chip shop', tags: { effort: 'low', style: 'convenience', weekend: true } },
  { text: 'Beans and cheese on toast, eaten late', tags: { effort: 'low', style: 'convenience', irregular: true } },
];

export const snacks = [
  { text: 'A piece of fruit', tags: { effort: 'low', style: 'homemade', structured: true } },
  { text: 'Greek yoghurt', tags: { effort: 'low', style: 'homemade', structured: true } },
  { text: 'A handful of nuts', tags: { effort: 'low', style: 'homemade', structured: true } },
  { text: 'Cheese and crackers', tags: { effort: 'low', style: 'homemade' } },
  { text: 'Houmous and carrot sticks', tags: { effort: 'low', style: 'homemade' } },
  { text: 'Toast', tags: { effort: 'low', style: 'homemade' } },
  { text: 'A small chocolate bar', tags: { effort: 'low', style: 'convenience' } },
  { text: 'Oatcakes', tags: { effort: 'low', style: 'homemade' } },
  { text: 'A cereal bar', tags: { effort: 'low', style: 'convenience' } },
  { text: 'A couple of biscuits with a cup of tea', tags: { effort: 'low', style: 'convenience' } },
  { text: 'A packet of crisps', tags: { effort: 'low', style: 'convenience', irregular: true } },
  { text: 'Whatever was in the cupboard', tags: { effort: 'low', style: 'convenience', irregular: true } },
];

// Saturday takeaway categories. At least one plausible description each.
export const takeaway = {
  Chinese: [
    'Chicken chow mein and spring rolls',
    'Sweet and sour chicken with egg fried rice',
    'Beef in black bean sauce with rice',
  ],
  Indian: [
    'Chicken tikka masala, rice and naan',
    'Lamb rogan josh with pilau rice',
    'Chicken korma, rice and a peshwari naan',
  ],
  Kebab: [
    'Chicken kebab with salad and pitta',
    'Lamb doner kebab and chips',
    'Mixed kebab with garlic sauce and salad',
  ],
  Pizza: [
    'Pizza with a side salad',
    'Pepperoni pizza and garlic bread',
    'Margherita pizza with a side of wedges',
  ],
  'Greek gyros': [
    'Chicken gyros in a pitta with salad and tzatziki',
    'Lamb gyros with chips and tzatziki',
    'Halloumi gyros with salad and pitta',
  ],
};

export const takeawayCategories = Object.keys(takeaway);
