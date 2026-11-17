// Dish library and constants, ported from the Serves Twenty prototype.
export type Mode = "tg" | "party";
export type Section = "P" | "M" | "D" | "B" | "F" | "C" | "S" | "K" | "X";
/** [name, quantity for one recipe, unit, grocery section] */
export type Ingredient = [string, number, string, Section];
/** [days before (or minutes before serving, for `day`), task text] */
export type Step = [number, string];

export interface Dish {
  id: string;
  kind?: "turkey" | "ham";
  short: string;
  name: string;
  cat: string;
  modes: Mode[];
  mode?: Mode;
  custom?: boolean;
  serves: number;
  whole?: boolean;
  noun?: [string, string];
  meta: string;
  blurb: string;
  ing: Ingredient[];
  ahead: Step[];
  day: Step[];
  /** custom recipes only */
  prep?: number;
  cook?: number;
  directions?: string[];
}

export interface Category { key: string; label: string; hint: string }
export interface Palette { deep: string; mid: string; soft: string }

export const ACC: Record<Mode, Palette> = {
  tg: { deep: "#A84A14", mid: "#EE9B4E", soft: "#FCE3C8" },
  party: { deep: "#6A3C9C", mid: "#B48BE0", soft: "#EEE3FA" }
};

export const TG_CATS: Category[] = [
  { key: "apps", label: "Appetizers", hint: "Something to nibble before dinner" },
  { key: "mains", label: "Mains", hint: "The star (or stars) of the table" },
  { key: "sides", label: "Sides", hint: "Honestly the best part" },
  { key: "sauces", label: "Sauces", hint: "Non-negotiable" },
  { key: "bread", label: "Bread", hint: "For mopping up gravy" },
  { key: "desserts", label: "Desserts", hint: "One pie feeds about 8" },
  { key: "drinks", label: "Drinks", hint: "" }
];
export const PARTY_CATS: Category[] = [
  { key: "apps", label: "Bites & apps", hint: "Easy to eat standing up" },
  { key: "mains", label: "Mains", hint: "Something hearty" },
  { key: "sides", label: "Sides", hint: "" },
  { key: "desserts", label: "Sweets", hint: "" },
  { key: "drinks", label: "Drinks", hint: "" }
];

const BOTH: Mode[] = ["tg", "party"], TG: Mode[] = ["tg"], PARTY: Mode[] = ["party"];

export const LIB: Dish[] = [
  { id: "board", short: "Cheese board", name: "Cheese & Charcuterie Board", cat: "apps", modes: BOTH, serves: 8, meta: "20 min · no cooking", blurb: "Three cheeses, cured meats, grapes, nuts & jam.",
    ing: [["Assorted cheeses (3 kinds)", 1, "lb", "D"], ["Salami or prosciutto", 0.75, "lb", "M"], ["Crackers", 2, "box", "C"], ["Red grapes", 1, "lb", "P"], ["Marcona almonds or mixed nuts", 1, "cup", "C"], ["Fig jam", 1, "jar", "C"]],
    ahead: [], day: [[90, "Build the cheese board, cover and chill"], [60, "Set the board out (cheese tastes best not fridge-cold)"]] },
  { id: "eggs", short: "Deviled eggs", name: "Deviled Eggs", cat: "apps", modes: BOTH, serves: 8, meta: "30 min · make ahead", blurb: "Classic, creamy, gone in five minutes.",
    ing: [["Large eggs", 8, "", "D"], ["Mayonnaise", 0.5, "cup", "C"], ["Dijon mustard", 2, "tsp", "C"], ["Paprika", 1, "tsp", "S"], ["Fresh chives", 1, "bunch", "P"]],
    ahead: [[1, "Deviled eggs: boil, peel and mix the filling (store whites and filling separately)"]], day: [[75, "Pipe filling into eggs, dust with paprika & chives"]] },
  { id: "dip", short: "Spinach dip", name: "Warm Spinach Artichoke Dip", cat: "apps", modes: BOTH, serves: 8, meta: "35 min · 350°F", blurb: "Bubbly, cheesy, scoopable.",
    ing: [["Frozen chopped spinach", 10, "oz", "F"], ["Artichoke hearts (14 oz)", 1, "can", "C"], ["Cream cheese", 8, "oz", "D"], ["Sour cream", 0.5, "cup", "D"], ["Parmesan, grated", 1, "cup", "D"], ["Mozzarella, shredded", 1, "cup", "D"], ["Garlic", 2, "clove", "P"], ["Tortilla chips or baguette", 1, "bag", "B"]],
    ahead: [[1, "Spinach dip: thaw & squeeze spinach, mix everything, refrigerate in the baking dish"]], day: [[95, "Spinach dip into the oven for ~30 min (it can share with the turkey at 325°F)"], [60, "Dip out, bubbly; serve with chips"]] },
  { id: "crudite", short: "Crudités", name: "Veggie Crudités & Ranch", cat: "apps", modes: BOTH, serves: 8, meta: "20 min · no cooking", blurb: "Something crunchy and fresh to balance the richness.",
    ing: [["Carrots", 1, "lb", "P"], ["Celery", 1, "bunch", "P"], ["Mini cucumbers", 4, "", "P"], ["Cherry tomatoes", 1, "pint", "P"], ["Sour cream", 1, "cup", "D"], ["Ranch seasoning packet", 1, "packet", "S"]],
    ahead: [[1, "Crudités: cut veggies, stir ranch seasoning into sour cream, chill"]], day: [[60, "Arrange veggies around the ranch dip"]] },
  { id: "brie", short: "Baked brie", name: "Baked Brie in Puff Pastry", cat: "apps", modes: BOTH, serves: 8, meta: "30 min · 400°F", blurb: "Golden pastry, molten brie, jam & pecans.",
    ing: [["Brie wheel (8 oz)", 1, "", "D"], ["Puff pastry sheet", 1, "sheet", "F"], ["Fig jam", 0.5, "jar", "C"], ["Pecans", 0.25, "cup", "C"], ["Honey", 2, "tbsp", "C"], ["Large eggs", 1, "", "D"], ["Crackers", 1, "box", "C"]],
    ahead: [[1, "Baked brie: wrap brie in pastry with jam & pecans, chill"]], day: [[100, "Brush brie with egg wash; bake ~30 min (share the oven, it just takes a little longer at 325°F)"], [60, "Brie out. Let it sit 10 min so it oozes instead of flooding"]] },
  { id: "wings", short: "Wings", name: "Baked Buffalo Wings", cat: "apps", modes: PARTY, serves: 6, meta: "1 hr · 425°F", blurb: "Crispy without a fryer. Blue cheese & celery on the side.",
    ing: [["Chicken wings", 3, "lb", "M"], ["Baking powder", 1, "tbsp", "X"], ["Buffalo hot sauce", 1, "cup", "C"], ["Unsalted butter", 0.5, "stick", "D"], ["Blue cheese dressing", 1, "cup", "C"], ["Celery", 1, "bunch", "P"]],
    ahead: [[1, "Wings: pat very dry, toss with baking powder & salt, refrigerate uncovered overnight"]], day: [[75, "Wings on a rack, bake at 425°F for 50 min, flipping halfway"], [20, "Melt butter into hot sauce, toss the wings"]] },
  { id: "sliders", short: "Sliders", name: "Cheeseburger Sliders", cat: "apps", modes: PARTY, serves: 6, meta: "40 min · 350°F", blurb: "A whole tray of tiny cheeseburgers on Hawaiian rolls.",
    ing: [["Ground beef", 1.5, "lb", "M"], ["Hawaiian rolls (12-pack)", 1, "pack", "B"], ["Cheddar slices", 6, "slices", "D"], ["Yellow onions", 1, "", "P"], ["Dill pickle chips", 1, "jar", "C"], ["Unsalted butter", 0.5, "stick", "D"], ["Sesame seeds", 1, "tbsp", "S"]],
    ahead: [[1, "Sliders: brown the beef with onion, chill"]], day: [[45, "Assemble sliders, brush with butter, bake at 350°F for 20 min"], [15, "Slice sliders apart & serve"]] },
  { id: "caprese", short: "Caprese", name: "Caprese Skewers", cat: "apps", modes: PARTY, serves: 10, meta: "20 min · no cooking", blurb: "Tomato, mozzarella, basil, balsamic. Cute on a stick.",
    ing: [["Cherry tomatoes", 1, "pint", "P"], ["Mini mozzarella balls", 8, "oz", "D"], ["Fresh basil", 1, "bunch", "P"], ["Balsamic glaze", 1, "bottle", "C"], ["Small skewers", 0.5, "pack", "C"]],
    ahead: [], day: [[120, "Thread caprese skewers, cover & chill"], [15, "Drizzle skewers with balsamic glaze & set out"]] },

  { id: "turkey", kind: "turkey", short: "Turkey", name: "Herb-Butter Roast Turkey", cat: "mains", modes: TG, serves: 0, meta: "Roasts at 325°F", blurb: "Butter & fresh herbs under the skin, aromatics inside. Sized automatically.",
    ing: [["Whole turkey", 14, "lb", "M"], ["Unsalted butter", 1, "stick", "D"], ["Fresh sage", 1, "bunch", "P"], ["Fresh thyme", 1, "bunch", "P"], ["Fresh rosemary", 1, "bunch", "P"], ["Yellow onions", 2, "", "P"], ["Lemons", 1, "", "P"], ["Garlic", 1, "head", "P"], ["Chicken broth", 2, "cup", "C"], ["Kosher salt", 3, "tbsp", "X"]],
    ahead: [], day: [] },
  { id: "ham", kind: "ham", short: "Ham", name: "Honey-Glazed Spiral Ham", cat: "mains", modes: BOTH, serves: 0, meta: "Already cooked, just warm & glaze", blurb: "Sweet, salty and easy. Great as a second main for a crowd.",
    ing: [["Bone-in spiral ham", 8, "lb", "M"], ["Brown sugar", 0.5, "cup", "C"], ["Honey", 0.25, "cup", "C"], ["Dijon mustard", 2, "tbsp", "C"], ["Ground cloves", 0.25, "tsp", "S"]],
    ahead: [[1, "Ham: whisk the glaze, refrigerate"]], day: [] },
  { id: "wellington", short: "Wellington", name: "Mushroom Wellington", cat: "mains", modes: BOTH, serves: 6, meta: "1 hr 15 min · 375°F", blurb: "A showstopping vegetarian main in flaky pastry.",
    ing: [["Cremini mushrooms", 1.5, "lb", "P"], ["Baby spinach", 5, "oz", "P"], ["Shallots", 2, "", "P"], ["Fresh thyme", 0.5, "bunch", "P"], ["Puff pastry sheet", 2, "sheet", "F"], ["Large eggs", 1, "", "D"], ["Parmesan, grated", 0.5, "cup", "D"]],
    ahead: [[1, "Wellington: cook down the mushroom filling, cool, wrap in pastry, chill"]], day: [[50, "Wellington: egg wash, bake at 375°F for ~45 min"]] },
  { id: "tacos", short: "Taco bar", name: "Build-Your-Own Taco Bar", cat: "mains", modes: PARTY, serves: 8, meta: "40 min · stovetop", blurb: "Seasoned beef plus a spread of toppings. Everyone builds their own.",
    ing: [["Ground beef", 2, "lb", "M"], ["Taco seasoning packet", 2, "packet", "S"], ["Flour or corn tortillas", 16, "", "B"], ["Cheddar, shredded", 2, "cup", "D"], ["Iceberg lettuce", 1, "head", "P"], ["Roma tomatoes", 3, "", "P"], ["Limes", 2, "", "P"], ["Sour cream", 1, "cup", "D"], ["Salsa (16 oz)", 1, "jar", "C"]],
    ahead: [[1, "Taco bar: shred lettuce, dice tomatoes, set toppings in bowls & chill"]], day: [[35, "Brown beef with seasoning; keep warm on low"], [10, "Warm tortillas wrapped in foil; set out toppings"]] },
  { id: "pork", short: "Pulled pork", name: "Slow-Cooker Pulled Pork Sliders", cat: "mains", modes: PARTY, serves: 10, meta: "8 hr slow cooker", blurb: "Set it in the morning, shred it at party time.",
    ing: [["Boneless pork shoulder", 4, "lb", "M"], ["BBQ sauce", 2, "cup", "C"], ["Brown sugar", 2, "tbsp", "C"], ["Yellow onions", 1, "", "P"], ["Slider buns", 20, "", "B"], ["Coleslaw mix", 1, "bag", "P"]],
    ahead: [], day: [[480, "Pork into the slow cooker on LOW (8 hrs) with onion & half the BBQ sauce"], [40, "Shred pork, stir in the rest of the sauce, keep warm"]] },
  { id: "ziti", short: "Baked ziti", name: "Baked Ziti with Sausage", cat: "mains", modes: PARTY, serves: 8, meta: "1 hr · 375°F", blurb: "Make it the day before, bake it day-of.",
    ing: [["Ziti pasta", 1, "lb", "C"], ["Marinara sauce (24 oz)", 1.5, "jar", "C"], ["Italian sausage", 1, "lb", "M"], ["Ricotta", 15, "oz", "D"], ["Mozzarella, shredded", 2, "cup", "D"], ["Parmesan, grated", 0.5, "cup", "D"], ["Fresh basil", 1, "bunch", "P"]],
    ahead: [[1, "Baked ziti: brown sausage, boil pasta, assemble in the dish, chill covered"]], day: [[70, "Ziti into a 375°F oven, covered, for 40 min"], [30, "Uncover ziti, bake 15 min more until bubbly"]] },

  { id: "mash", short: "Mashed potatoes", name: "Creamy Mashed Potatoes", cat: "sides", modes: TG, serves: 8, meta: "1 hr · stovetop", blurb: "Yukon Golds, lots of butter, a little sour cream.",
    ing: [["Yukon Gold potatoes", 4, "lb", "P"], ["Unsalted butter", 1, "stick", "D"], ["Whole milk", 1, "cup", "D"], ["Sour cream", 0.5, "cup", "D"], ["Kosher salt", 1, "tbsp", "X"]],
    ahead: [[1, "Mashed potatoes: peel & cube, store covered in cold water in the fridge"]], day: [[80, "Potatoes into cold salted water; bring to a boil and cook until tender (~40 min total)"], [35, "Drain & mash with warm butter, milk & sour cream; keep warm, covered"]] },
  { id: "stuffing", short: "Stuffing", name: "Classic Herb Stuffing", cat: "sides", modes: TG, serves: 8, meta: "1 hr · 375°F", blurb: "Crispy top, soft middle, lots of sage.",
    ing: [["Crusty bread (1-lb loaves)", 1.5, "", "B"], ["Unsalted butter", 1, "stick", "D"], ["Yellow onions", 1, "", "P"], ["Celery", 0.5, "bunch", "P"], ["Fresh sage", 0.5, "bunch", "P"], ["Fresh thyme", 0.5, "bunch", "P"], ["Chicken broth", 3, "cup", "C"], ["Large eggs", 2, "", "D"]],
    ahead: [[2, "Stuffing: cube the bread, spread on sheet pans to dry out"], [1, "Stuffing: sauté onion, celery & herbs in butter; chill"]], day: [[50, "Stuffing: toss bread, veg, broth & eggs; bake at 375°F covered 25 min, then uncovered 20"]] },
  { id: "gbc", short: "Green bean casserole", name: "Green Bean Casserole", cat: "sides", modes: TG, serves: 8, meta: "45 min · 375°F", blurb: "The classic, with fresh beans and crispy onions.",
    ing: [["Fresh green beans", 2, "lb", "P"], ["Cream of mushroom soup (10.5 oz)", 2, "can", "C"], ["Whole milk", 0.75, "cup", "D"], ["Soy sauce", 1, "tsp", "C"], ["Crispy fried onions (6 oz)", 1, "can", "C"]],
    ahead: [[1, "Green bean casserole: blanch beans, assemble without the onions, chill"]], day: [[50, "Green bean casserole into the 375°F oven for 25 min"], [25, "Top casserole with fried onions, bake 5 more min"]] },
  { id: "mac", short: "Mac & cheese", name: "Baked Mac & Cheese", cat: "sides", modes: BOTH, serves: 8, meta: "1 hr · 375°F", blurb: "Sharp cheddar and Gruyère under a crunchy panko top.",
    ing: [["Elbow macaroni", 1, "lb", "C"], ["Sharp cheddar", 1, "lb", "D"], ["Gruyère", 8, "oz", "D"], ["Whole milk", 3, "cup", "D"], ["Unsalted butter", 0.5, "stick", "D"], ["All-purpose flour", 0.25, "cup", "X"], ["Panko breadcrumbs", 0.5, "cup", "C"]],
    ahead: [[1, "Mac & cheese: cook pasta al dente, make the sauce, assemble & chill (crumbs go on day-of)"]], day: [[50, "Top mac with panko, bake at 375°F for 30–35 min"]] },
  { id: "sweet", short: "Sweet potatoes", name: "Sweet Potato Casserole", cat: "sides", modes: TG, serves: 8, meta: "1 hr 30 min · 375°F", blurb: "Silky sweet potatoes, toasted marshmallows & pecans.",
    ing: [["Sweet potatoes", 4, "lb", "P"], ["Unsalted butter", 0.5, "stick", "D"], ["Brown sugar", 0.5, "cup", "C"], ["Large eggs", 2, "", "D"], ["Vanilla extract", 1, "tsp", "X"], ["Mini marshmallows (10 oz)", 1, "bag", "C"], ["Pecans", 0.5, "cup", "C"]],
    ahead: [[2, "Sweet potatoes: roast until soft, then mash"], [1, "Sweet potato casserole: mix filling, spread in the dish, chill"]], day: [[50, "Sweet potato casserole into the oven for 25 min"], [20, "Marshmallows on top, bake until toasty (watch it!)"]] },
  { id: "brussels", short: "Brussels sprouts", name: "Roasted Brussels Sprouts with Bacon", cat: "sides", modes: TG, serves: 8, meta: "45 min · 375°F", blurb: "Crispy edges, bacon, maple-balsamic glaze.",
    ing: [["Brussels sprouts", 2, "lb", "P"], ["Thick-cut bacon", 0.5, "lb", "M"], ["Olive oil", 3, "tbsp", "X"], ["Maple syrup", 2, "tbsp", "C"], ["Balsamic vinegar", 1, "tbsp", "C"]],
    ahead: [[1, "Brussels: trim & halve sprouts, cook the bacon"]], day: [[50, "Brussels sprouts on the top rack at 375°F for 35 min"], [10, "Toss sprouts with bacon & maple-balsamic"]] },
  { id: "salad", short: "Harvest salad", name: "Harvest Salad", cat: "sides", modes: BOTH, serves: 8, meta: "15 min · no cooking", blurb: "Greens, apple, dried cranberries, goat cheese, pecans.",
    ing: [["Mixed greens", 10, "oz", "P"], ["Honeycrisp apples", 2, "", "P"], ["Dried cranberries", 0.5, "cup", "C"], ["Pecans", 0.5, "cup", "C"], ["Goat cheese", 4, "oz", "D"], ["Olive oil", 0.25, "cup", "X"], ["Apple cider vinegar", 2, "tbsp", "C"], ["Dijon mustard", 1, "tsp", "C"]],
    ahead: [[1, "Salad: whisk the dressing, toast the pecans"]], day: [[15, "Slice apples, toss the salad with dressing"]] },
  { id: "slaw", short: "Coleslaw", name: "Tangy Coleslaw", cat: "sides", modes: PARTY, serves: 8, meta: "10 min · no cooking", blurb: "Creamy-tangy and better after it sits.",
    ing: [["Coleslaw mix", 1, "bag", "P"], ["Mayonnaise", 0.5, "cup", "C"], ["Apple cider vinegar", 2, "tbsp", "C"], ["Sugar", 1, "tbsp", "X"], ["Celery seed", 0.5, "tsp", "S"]],
    ahead: [], day: [[180, "Make coleslaw and chill"]] },
  { id: "fruit", short: "Fruit salad", name: "Honey-Lime Fruit Salad", cat: "sides", modes: PARTY, serves: 10, meta: "20 min · no cooking", blurb: "Berries, pineapple and grapes with a honey-lime toss.",
    ing: [["Strawberries", 1, "lb", "P"], ["Pineapple", 1, "", "P"], ["Blueberries", 1, "pint", "P"], ["Red grapes", 1, "lb", "P"], ["Limes", 1, "", "P"], ["Honey", 1, "tbsp", "C"]],
    ahead: [], day: [[120, "Cut fruit, toss with lime & honey, chill"]] },

  { id: "gravy", short: "Gravy", name: "Pan Gravy", cat: "sauces", modes: TG, serves: 12, meta: "15 min · stovetop", blurb: "Made from the turkey drippings while the bird rests.",
    ing: [["Unsalted butter", 0.5, "stick", "D"], ["All-purpose flour", 6, "tbsp", "X"], ["Chicken broth", 4, "cup", "C"], ["Fresh thyme", 0.25, "bunch", "P"]],
    ahead: [[1, "Gravy head start: simmer the turkey neck & giblets in broth for a richer stock"]], day: [[40, "Gravy: whisk drippings, butter & flour, add broth, simmer 10 min"]] },
  { id: "cran", short: "Cranberry sauce", name: "Fresh Cranberry Sauce", cat: "sauces", modes: TG, serves: 10, meta: "15 min · make ahead", blurb: "Bright, jammy and so much better than the can.",
    ing: [["Fresh cranberries (12 oz)", 1, "bag", "P"], ["Sugar", 1, "cup", "X"], ["Oranges", 1, "", "P"]],
    ahead: [[3, "Cranberry sauce: simmer berries, sugar & orange juice 10 min; chill (it sets up)"]], day: [[60, "Cranberry sauce out of the fridge into a pretty bowl"]] },

  { id: "rolls", short: "Rolls", name: "Warm Dinner Rolls", cat: "bread", modes: TG, serves: 8, meta: "10 min · store-bought", blurb: "Soft rolls, warmed, with salted butter.",
    ing: [["Dinner rolls", 12, "", "B"], ["Salted butter (for the table)", 0.5, "stick", "D"]],
    ahead: [], day: [[15, "Warm rolls wrapped in foil for 10 min"]] },
  { id: "cornbread", short: "Cornbread", name: "Honey Cornbread", cat: "bread", modes: TG, serves: 9, meta: "35 min · 400°F", blurb: "Tender, a little sweet, drizzled with honey.",
    ing: [["Yellow cornmeal", 1, "cup", "C"], ["All-purpose flour", 1, "cup", "X"], ["Whole milk", 1, "cup", "D"], ["Large eggs", 2, "", "D"], ["Unsalted butter", 0.5, "stick", "D"], ["Sugar", 0.25, "cup", "X"], ["Baking powder", 1, "tbsp", "X"], ["Honey", 2, "tbsp", "C"]],
    ahead: [[1, "Bake cornbread (400°F, 22 min); cool & wrap"]], day: [[15, "Rewarm cornbread, drizzle with honey"]] },

  { id: "pumpkin", short: "Pumpkin pie", name: "Pumpkin Pie", cat: "desserts", modes: TG, serves: 8, whole: true, noun: ["pie", "pies"], meta: "1 hr 15 min · make ahead", blurb: "Silky spiced custard. Whipped cream required.",
    ing: [["Pumpkin purée (15 oz)", 1, "can", "C"], ["Evaporated milk (12 oz)", 1, "can", "C"], ["Large eggs", 2, "", "D"], ["Sugar", 0.75, "cup", "X"], ["Pumpkin pie spice", 2, "tsp", "S"], ["Refrigerated pie crust", 1, "", "B"], ["Heavy cream (for whipping)", 1, "cup", "D"]],
    ahead: [[1, "Bake pumpkin pie (425°F 15 min, then 350°F 40–50 min); cool & chill"]], day: [[-45, "Whip the cream & slice the pies"]] },
  { id: "apple", short: "Apple pie", name: "Apple Pie", cat: "desserts", modes: TG, serves: 8, whole: true, noun: ["pie", "pies"], meta: "1 hr 30 min · make ahead", blurb: "Double crust, tart apples, cinnamon.",
    ing: [["Granny Smith apples", 3, "lb", "P"], ["Sugar", 0.75, "cup", "X"], ["All-purpose flour", 2, "tbsp", "X"], ["Ground cinnamon", 1, "tsp", "S"], ["Lemons", 1, "", "P"], ["Unsalted butter", 0.25, "stick", "D"], ["Refrigerated pie crust", 2, "", "B"]],
    ahead: [[1, "Bake apple pie (425°F, ~50 min). It slices cleaner after a night’s rest"]], day: [[-30, "Rewarm apple pie in the now-free oven for 15 min"]] },
  { id: "pecan", short: "Pecan pie", name: "Pecan Pie", cat: "desserts", modes: TG, serves: 8, whole: true, noun: ["pie", "pies"], meta: "1 hr 15 min · make ahead", blurb: "Gooey, toasty, keeps beautifully.",
    ing: [["Pecans", 2, "cup", "C"], ["Light corn syrup", 1, "cup", "C"], ["Brown sugar", 0.5, "cup", "C"], ["Large eggs", 3, "", "D"], ["Unsalted butter", 0.5, "stick", "D"], ["Vanilla extract", 1, "tsp", "X"], ["Refrigerated pie crust", 1, "", "B"]],
    ahead: [[2, "Bake pecan pie (350°F, ~55 min); cool, cover"]], day: [] },
  { id: "crisp", short: "Apple crisp", name: "Apple-Cranberry Crisp", cat: "desserts", modes: BOTH, serves: 8, meta: "1 hr · 375°F", blurb: "Warm from the oven with vanilla ice cream.",
    ing: [["Granny Smith apples", 3, "lb", "P"], ["Fresh cranberries (12 oz)", 0.5, "bag", "P"], ["Old-fashioned oats", 1, "cup", "C"], ["Brown sugar", 0.75, "cup", "C"], ["All-purpose flour", 0.5, "cup", "X"], ["Unsalted butter", 1, "stick", "D"], ["Ground cinnamon", 1, "tsp", "S"], ["Vanilla ice cream", 1.5, "quart", "F"]],
    ahead: [[1, "Crisp: mix the crumble topping, chill"]], day: [[-15, "Crisp into the oven (375°F, 40 min) as you sit down"]] },
  { id: "cookies", short: "Cookies", name: "Chocolate Chip Cookies", cat: "desserts", modes: BOTH, serves: 12, meta: "45 min · make ahead", blurb: "About 24 cookies per batch. Crowd-pleaser, kid-approved.",
    ing: [["All-purpose flour", 2.25, "cup", "X"], ["Unsalted butter", 2, "stick", "D"], ["Brown sugar", 0.75, "cup", "C"], ["Sugar", 0.75, "cup", "X"], ["Large eggs", 2, "", "D"], ["Vanilla extract", 2, "tsp", "X"], ["Baking soda", 1, "tsp", "X"], ["Chocolate chips (12 oz)", 1, "bag", "C"]],
    ahead: [[1, "Bake chocolate chip cookies (375°F, ~10 min a tray); store airtight"]], day: [] },
  { id: "brownies", short: "Brownies", name: "Fudgy Brownies", cat: "desserts", modes: PARTY, serves: 16, meta: "45 min · make ahead", blurb: "Crackly tops, flaky salt.",
    ing: [["Unsalted butter", 1, "stick", "D"], ["Semi-sweet chocolate", 8, "oz", "C"], ["Sugar", 1, "cup", "X"], ["Large eggs", 3, "", "D"], ["All-purpose flour", 0.75, "cup", "X"], ["Cocoa powder", 0.25, "cup", "C"], ["Flaky sea salt", 1, "tsp", "S"]],
    ahead: [[1, "Bake brownies (350°F, 25 min); cool, cut, cover"]], day: [] },

  { id: "cider", short: "Mulled cider", name: "Hot Mulled Cider", cat: "drinks", modes: BOTH, serves: 16, meta: "Slow cooker", blurb: "Makes the whole house smell like fall.",
    ing: [["Apple cider", 1, "gallon", "K"], ["Cinnamon sticks", 4, "", "S"], ["Oranges", 1, "", "P"], ["Whole cloves", 1, "tsp", "S"]],
    ahead: [], day: [[90, "Cider & spices into a slow cooker on LOW"]] },
  { id: "wine", short: "Wine", name: "Wine (red & white)", cat: "drinks", modes: BOTH, serves: 2, whole: true, noun: ["bottle", "bottles"], meta: "About a bottle per 2 guests", blurb: "A mix: Pinot Noir and a crisp white go with everything.",
    ing: [["Wine (mix of red & white)", 1, "bottle", "K"]],
    ahead: [[1, "Chill the white & sparkling wine"]], day: [[30, "Open the reds to breathe"]] },
  { id: "punch", short: "Punch", name: "Sparkling Cranberry Punch", cat: "drinks", modes: BOTH, serves: 12, meta: "10 min · alcohol-free", blurb: "Festive, fizzy and kid-friendly. Spike it if you like.",
    ing: [["Cranberry juice (64 oz)", 1, "bottle", "K"], ["Ginger ale (2 L)", 1, "bottle", "K"], ["Oranges", 1, "", "P"], ["Fresh cranberries (12 oz)", 0.25, "bag", "P"], ["Fresh rosemary", 0.5, "bunch", "P"]],
    ahead: [[1, "Freeze cranberries & rosemary in ice cube trays (so cute)"]], day: [[10, "Mix punch: juice, ginger ale, orange slices & the fancy ice"]] },
  { id: "sangria", short: "Sangria", name: "Red Sangria", cat: "drinks", modes: PARTY, serves: 8, meta: "Make the night before", blurb: "Fruity, make-ahead, one big pitcher.",
    ing: [["Red wine", 2, "bottle", "K"], ["Brandy", 0.5, "cup", "K"], ["Orange juice", 1, "cup", "K"], ["Oranges", 2, "", "P"], ["Honeycrisp apples", 1, "", "P"], ["Club soda (1 L)", 1, "bottle", "K"]],
    ahead: [[1, "Sangria: mix wine, brandy, juice & fruit; chill overnight"]], day: [[5, "Top the sangria with club soda"]] },
  { id: "beer", short: "Beer & seltzer", name: "Beer & Hard Seltzer", cat: "drinks", modes: PARTY, serves: 6, whole: true, noun: ["12-pack", "12-packs"], meta: "About 2 per guest", blurb: "Grab a mix and a cooler full of ice.",
    ing: [["Beer & hard seltzer (12-packs)", 1, "pack", "K"]],
    ahead: [[1, "Beer & seltzers into the fridge"]], day: [[60, "Fill a cooler with ice & drinks"]] }
];

export const DEFAULT_TG: string[] = ["board", "eggs", "crudite", "turkey", "mash", "stuffing", "gbc", "sweet", "mac", "gravy", "cran", "rolls", "pumpkin", "apple", "pecan", "cider", "wine"];
export const DEFAULT_PARTY: string[] = ["board", "caprese", "tacos", "mac", "slaw", "salad", "cookies", "sangria", "punch"];

export const SECTIONS: [Section, string][] = [["P", "Produce"], ["M", "Meat"], ["D", "Dairy & eggs"], ["B", "Bakery"], ["F", "Frozen"], ["C", "Pantry & canned"], ["S", "Spices"], ["K", "Drinks"], ["X", "Staples: check your pantry"]];
