/**
 * Seed the database with a demo chef and a handful of recipes so the site isn't empty.
 *   npm run seed            # adds sample data (skips if recipes already exist)
 *   npm run seed -- --force # wipes recipes/reviews/comments and the demo chef first
 *
 * Images use Cloudinary's public demo cloud so no upload credentials are needed.
 * Log in as demo@example.com / demopassword1 to edit or delete them.
 */
require("dotenv").config();
const mongoose = require("mongoose");
const User = require("../models/user");
const Recipe = require("../models/recipe");
const Review = require("../models/review");
const Comment = require("../models/comment");
const { textToHtml } = require("../lib/seo");

const DEMO = { username: "demo@example.com", password: "demopassword1", screenName: "DemoChef", firstName: "Demo", avatar: "🍳", verified: true, bio: "Sample recipes to show how the site works." };
const IMG = (id) => `https://res.cloudinary.com/demo/image/upload/${id}.jpg`;

const RECIPES = [
  {
    title: "Fluffy Buttermilk Pancakes",
    summary: "Tall, tender pancakes with crisp edges, ready in 25 minutes from pantry staples.",
    description: "These are the pancakes I grew up on. Buttermilk gives them a gentle tang and reacts with the baking soda for an extra-fluffy rise.\n\nDon't overmix: a few lumps in the batter are exactly what you want.",
    image: IMG("samples/breakfast"),
    prepTime: 10, cookTime: 15, servings: 4, category: "Breakfast", cuisine: "American", difficulty: 0,
    allergens: ["Vegetarian", "Nut-Free"], tags: ["weekend", "kid-friendly", "classic"],
    ingredients: ["2 cups all-purpose flour", "2 tablespoons sugar", "2 teaspoons baking powder", "1 teaspoon baking soda", "1/2 teaspoon salt", "2 cups buttermilk", "2 large eggs", "3 tablespoons melted butter, plus more for the pan"],
    directions: ["Whisk the flour, sugar, baking powder, baking soda and salt in a large bowl.", "In a second bowl whisk the buttermilk, eggs and melted butter.", "Pour the wet ingredients into the dry and stir just until combined. Lumps are fine.", "Heat a skillet over medium heat and brush with butter.", "Pour 1/3 cup batter per pancake. Cook until bubbles form and edges look dry, about 2 minutes, then flip and cook 1 to 2 minutes more.", "Serve warm with maple syrup."]
  },
  {
    title: "Weeknight Chicken Tikka Masala",
    summary: "Creamy, gently spiced chicken tikka masala that comes together in one pan in about 45 minutes.",
    description: "A streamlined take on the takeout favorite. Marinating the chicken in yogurt for even 15 minutes keeps it juicy, and a splash of cream at the end rounds out the tomato sauce.",
    image: IMG("samples/food/pot-mussels"),
    prepTime: 15, cookTime: 30, servings: 4, category: "Dinner", cuisine: "Indian", difficulty: 1,
    allergens: ["Gluten-Free", "Nut-Free"], tags: ["one-pan", "weeknight", "comfort food"],
    ingredients: ["1 1/2 pounds boneless chicken thighs, cut into chunks", "1 cup plain yogurt", "2 tablespoons garam masala", "1 teaspoon turmeric", "1 teaspoon salt", "2 tablespoons oil", "1 onion, diced", "4 cloves garlic, minced", "1 tablespoon grated ginger", "1 can (28 oz) crushed tomatoes", "1/2 cup heavy cream", "Fresh cilantro and cooked rice, to serve"],
    directions: ["Toss the chicken with yogurt, half the garam masala, turmeric and salt. Let sit 15 minutes.", "Heat the oil in a large skillet over medium-high. Sear the chicken in batches until browned; set aside.", "Add the onion and cook until soft, 5 minutes. Add garlic, ginger and remaining garam masala; cook 1 minute.", "Pour in the tomatoes and simmer 10 minutes.", "Return the chicken, stir in the cream and simmer until the chicken is cooked through, about 8 minutes.", "Top with cilantro and serve over rice."]
  },
  {
    title: "Roasted Vegetable Grain Bowl with Lemon Tahini",
    summary: "A make-ahead vegan lunch bowl: roasted sweet potato and chickpeas over quinoa with a bright lemon tahini dressing.",
    description: "Roast a big tray of vegetables on Sunday and you have lunch for the week. The tahini dressing keeps for five days in the fridge.",
    image: IMG("samples/food/spices"),
    prepTime: 15, cookTime: 30, servings: 4, category: "Lunch", cuisine: "Mediterranean", difficulty: 0,
    allergens: ["Vegan", "Vegetarian", "Gluten-Free", "Dairy-Free"], tags: ["meal prep", "healthy", "bowl"],
    ingredients: ["1 cup quinoa", "2 sweet potatoes, cubed", "1 can (15 oz) chickpeas, drained", "2 tablespoons olive oil", "1 teaspoon smoked paprika", "Salt and pepper", "1/4 cup tahini", "Juice of 1 lemon", "1 clove garlic, grated", "2 to 4 tablespoons water", "2 cups baby spinach"],
    directions: ["Heat the oven to 425°F. Cook the quinoa according to package directions.", "Toss sweet potatoes and chickpeas with olive oil, paprika, salt and pepper. Roast 25 to 30 minutes until browned.", "Whisk tahini, lemon juice, garlic and enough water to make a pourable dressing. Season with salt.", "Divide quinoa and spinach among bowls, top with the roasted vegetables and drizzle with dressing."]
  },
  {
    title: "Salted Dark Chocolate Chip Cookies",
    summary: "Chewy centers, crisp edges, big puddles of dark chocolate and a sprinkle of flaky salt.",
    description: "Browning the butter and resting the dough overnight are the two steps that turn a good cookie into a great one. If you're in a hurry, a 30 minute chill still helps.",
    image: IMG("samples/food/dessert"),
    prepTime: 20, cookTime: 12, servings: 24, category: "Dessert", cuisine: "American", difficulty: 1,
    allergens: ["Vegetarian", "Nut-Free"], tags: ["baking", "chocolate", "cookies"],
    ingredients: ["1 cup (2 sticks) unsalted butter", "1 cup brown sugar", "1/2 cup granulated sugar", "2 large eggs", "2 teaspoons vanilla", "2 1/4 cups all-purpose flour", "1 teaspoon baking soda", "1 teaspoon salt", "10 ounces dark chocolate, chopped", "Flaky sea salt for topping"],
    directions: ["Melt the butter in a saucepan and cook, swirling, until golden and nutty smelling. Cool 10 minutes.", "Beat the browned butter with both sugars, then beat in eggs and vanilla.", "Stir in flour, baking soda and salt, then fold in the chocolate.", "Chill the dough at least 30 minutes, ideally overnight.", "Heat the oven to 350°F. Scoop 2 tablespoon balls onto lined sheets, sprinkle with flaky salt.", "Bake 11 to 13 minutes until edges are set and centers still look soft. Cool on the sheet 5 minutes."]
  },
  {
    title: "Fresh Mango Lassi",
    summary: "A five-minute mango yogurt smoothie that's naturally sweet and perfect with spicy food.",
    description: "Use ripe mango for the best flavor. Frozen mango chunks work well too and make the drink extra frosty.",
    image: IMG("samples/cup-on-a-table"),
    prepTime: 5, cookTime: 0, servings: 2, category: "Beverage", cuisine: "Indian", difficulty: 0,
    allergens: ["Vegetarian", "Gluten-Free", "Nut-Free"], tags: ["quick", "smoothie", "no-cook"],
    ingredients: ["2 cups ripe mango chunks", "1 cup plain yogurt", "1/2 cup milk", "1 to 2 tablespoons honey or sugar", "Pinch of ground cardamom", "Ice, optional"],
    directions: ["Combine everything in a blender.", "Blend until completely smooth, about 1 minute.", "Taste and adjust sweetness. Serve cold."]
  },
  {
    title: "Crispy Smashed Potatoes with Garlic Herb Butter",
    summary: "Boiled, smashed and roasted until shatteringly crisp, then tossed in garlic herb butter.",
    description: "Small waxy potatoes hold together best. Get them really dry before roasting and don't crowd the pan.",
    image: IMG("samples/food/fish-vegetables"),
    prepTime: 10, cookTime: 45, servings: 4, category: "Snack", cuisine: "American", difficulty: 0,
    allergens: ["Vegetarian", "Gluten-Free", "Nut-Free"], tags: ["side dish", "potatoes", "crowd-pleaser"],
    ingredients: ["1 1/2 pounds small yellow potatoes", "3 tablespoons olive oil", "Salt and pepper", "3 tablespoons butter", "3 cloves garlic, minced", "2 tablespoons chopped parsley", "1 tablespoon chopped rosemary"],
    directions: ["Boil the potatoes in salted water until fork-tender, 15 to 20 minutes. Drain and let dry 5 minutes.", "Heat the oven to 450°F. Arrange potatoes on an oiled sheet pan and press each with a glass to flatten.", "Drizzle with oil, season, and roast 25 to 30 minutes until deeply golden and crisp.", "Melt butter with garlic over low heat 2 minutes; stir in herbs.", "Toss the hot potatoes with the garlic herb butter and serve."]
  }
];

async function main() {
  const force = process.argv.includes("--force");
  await mongoose.connect(process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/recipes");

  if (force) {
    await Promise.all([Recipe.deleteMany({}), Review.deleteMany({}), Comment.deleteMany({}), User.deleteOne({ username: DEMO.username })]);
    console.log("Cleared recipes, reviews, comments and demo chef.");
  } else if ((await Recipe.countDocuments()) > 0) {
    console.log("Recipes already exist; nothing to do. Use --force to reseed.");
    return mongoose.disconnect();
  }

  let chef = await User.findOne({ username: DEMO.username });
  if (!chef) {
    chef = new User({ ...DEMO });
    await User.register(chef, DEMO.password);
    console.log(`Created demo chef ${DEMO.username} / ${DEMO.password}`);
  }

  for (const r of RECIPES) {
    const recipe = await Recipe.create({
      ...r,
      description: textToHtml(r.description),
      totalTime: r.prepTime + r.cookTime,
      slug: await Recipe.uniqueSlug(r.title),
      imageId: "seed/" + r.image.split("/").pop(),
      chef: { id: chef._id, screenName: chef.screenName, avatar: chef.avatar },
      views: Math.floor(Math.random() * 200)
    });
    chef.recipes.push(recipe._id);
    console.log("+", recipe.title, "->", recipe.url);
  }
  await chef.save();
  await mongoose.disconnect();
  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
