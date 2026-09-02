const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");

process.env.NODE_ENV = "test";
process.env.SITE_URL = "https://example.test";
process.env.SESSION_SECRET = "test-secret";

const { MongoMemoryServer } = require("mongodb-memory-server");
const mongoose = require("mongoose");
const request = require("supertest");

let mongod;
let app;
let agent;
let recipeUrl;

before(async () => {
  // Use a real server when TEST_MONGODB_URI is set (CI / sandboxes that can't download mongod), else an in-memory one.
  if (process.env.TEST_MONGODB_URI) {
    await mongoose.connect(process.env.TEST_MONGODB_URI);
    await mongoose.connection.dropDatabase();
  } else {
    mongod = await MongoMemoryServer.create();
    await mongoose.connect(mongod.getUri());
  }

  // Stub Cloudinary so tests don't hit the network.
  const images = require("../lib/cloudinary");
  images.isConfigured = () => true;
  images.uploadBuffer = async () => ({ secure_url: "https://res.cloudinary.com/demo/image/upload/v1/recipes/test.jpg", public_id: "recipes/test" });
  images.destroy = async () => {};

  app = require("../app");
  agent = request.agent(app);
});

after(async () => {
  await mongoose.disconnect();
  if (mongod) await mongod.stop();
});

test("home page renders with SEO tags", async () => {
  const res = await request(app).get("/");
  assert.equal(res.status, 200);
  assert.match(res.text, /<link rel="canonical" href="https:\/\/example.test\/">/);
  assert.match(res.text, /application\/ld\+json/);
  assert.match(res.text, /"@type":"WebSite"/);
  assert.match(res.text, /id="cooking-container"/, "loading animation markup present");
});

test("robots.txt and sitemap.xml", async () => {
  const robots = await request(app).get("/robots.txt");
  assert.equal(robots.status, 200);
  assert.match(robots.text, /Sitemap: https:\/\/example.test\/sitemap.xml/);
  const sitemap = await request(app).get("/sitemap.xml");
  assert.equal(sitemap.status, 200);
  assert.match(sitemap.headers["content-type"], /xml/);
  assert.match(sitemap.text, /<loc>https:\/\/example.test\/recipes\/collections\/dinner<\/loc>/);
});

test("collection page renders", async () => {
  const res = await request(app).get("/recipes/collections/vegan");
  assert.equal(res.status, 200);
  assert.match(res.text, /<title>Vegan Recipes \|/);
});

test("legacy filter URL redirects to collection", async () => {
  const res = await request(app).get("/?category=Dinner&pageTitle=Dinner%20Recipes");
  assert.equal(res.status, 301);
  assert.equal(res.headers.location, "/recipes/collections/dinner");
});

test("unknown page is 404", async () => {
  const res = await request(app).get("/nope");
  assert.equal(res.status, 404);
  const r2 = await request(app).get("/recipes/does-not-exist");
  assert.equal(r2.status, 404);
});

test("register creates user and logs in", async () => {
  const res = await agent.post("/register").type("form").send({ username: "Palmer@Example.com", screenName: "palmer", firstName: "Palmer", password: "supersecret1", avatar: "🍳" });
  assert.equal(res.status, 302);
  assert.match(res.headers.location, /^\/users\//);
  const User = require("../models/user");
  const user = await User.findOne({ username: "palmer@example.com" });
  assert.ok(user);
  assert.equal(user.verified, false);
  assert.ok(user.verificationToken);
});

test("unverified user cannot post a recipe", async () => {
  const res = await agent.get("/recipes/new");
  assert.equal(res.status, 302);
  assert.match(res.headers.location, /^\/users\//);
});

test("email verification flips the flag", async () => {
  const User = require("../models/user");
  const user = await User.findOne({ username: "palmer@example.com" });
  const res = await agent.get(`/verify/${user.verificationToken}`);
  assert.equal(res.status, 302);
  const updated = await User.findById(user._id);
  assert.equal(updated.verified, true);
  assert.equal(updated.verificationToken, undefined);
});

test("verified user can create a recipe with slug and structured data", async () => {
  const res = await agent
    .post("/recipes")
    .field("title", "Grandma's Buttermilk Pancakes & Syrup")
    .field("summary", "Fluffy pancakes in 20 minutes.")
    .field("description", "Best pancakes.\n\nSecond paragraph <script>alert(1)</script>")
    .field("prepTime", "10")
    .field("cookTime", "10")
    .field("servings", "4")
    .field("category", "Breakfast")
    .field("difficulty", "0")
    .field("allergens[]", "Vegetarian")
    .field("tags", "weekend, kid-friendly")
    .field("ingredients[]", "2 cups flour")
    .field("ingredients[]", "2 cups buttermilk")
    .field("directions[]", "Mix.")
    .field("directions[]", "Fry.")
    .attach("image", Buffer.from("fakeimage"), { filename: "p.jpg", contentType: "image/jpeg" });
  assert.equal(res.status, 302);
  recipeUrl = res.headers.location;
  assert.equal(recipeUrl, "/recipes/grandma-s-buttermilk-pancakes-and-syrup");

  const show = await request(app).get(recipeUrl);
  assert.equal(show.status, 200);
  assert.doesNotMatch(show.text, /<script>alert/);
  assert.match(show.text, /<title>Grandma&#39;s Buttermilk Pancakes &amp; Syrup Recipe \|/);
  const ld = [...show.text.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/gs)].map((m) => JSON.parse(m[1]));
  const recipe = ld.find((d) => d["@type"] === "Recipe");
  assert.ok(recipe, "Recipe JSON-LD present");
  assert.equal(recipe.prepTime, "PT10M");
  assert.equal(recipe.totalTime, "PT20M");
  assert.deepEqual(recipe.recipeIngredient, ["2 cups flour", "2 cups buttermilk"]);
  assert.equal(recipe.recipeInstructions.length, 2);
  assert.equal(recipe.recipeInstructions[0]["@type"], "HowToStep");
  assert.deepEqual(recipe.suitableForDiet, ["https://schema.org/VegetarianDiet"]);
  assert.equal(recipe.recipeYield, "4 servings");
  assert.ok(ld.find((d) => d["@type"] === "BreadcrumbList"));
  assert.match(show.text, /res\.cloudinary\.com\/demo\/image\/upload\/f_auto,q_auto,w_800,h_600,c_fill,g_auto\//);
});

test("legacy ObjectId URL 301s to slug", async () => {
  const Recipe = require("../models/recipe");
  const r = await Recipe.findOne({});
  const res = await request(app).get(`/recipes/${r._id}`);
  assert.equal(res.status, 301);
  assert.equal(res.headers.location, recipeUrl);
});

test("review updates rating and aggregateRating appears", async () => {
  const res = await agent.post(`${recipeUrl}/reviews`).type("form").send({ "review[rating]": "4", "review[text]": "Great!" });
  assert.equal(res.status, 302);
  const dup = await agent.post(`${recipeUrl}/reviews`).type("form").send({ "review[rating]": "5" });
  assert.equal(dup.status, 302);
  const Recipe = require("../models/recipe");
  const r = await Recipe.findOne({});
  assert.equal(r.rating, 4);
  assert.equal(r.reviews.length, 1);
  const show = await request(app).get(recipeUrl);
  assert.match(show.text, /"aggregateRating":\{"@type":"AggregateRating","ratingValue":4,"ratingCount":1/);
});

test("comment and favorite work", async () => {
  await agent.post(`${recipeUrl}/comments`).type("form").send({ "comment[text]": "Yum" }).expect(302);
  await agent.post(`${recipeUrl}/love`).expect(302);
  const Recipe = require("../models/recipe");
  const r = await Recipe.findOne({});
  assert.equal(r.comments.length, 1);
  assert.equal(r.lovedBy.length, 1);
  await agent.post(`${recipeUrl}/love`).expect(302);
  const r2 = await Recipe.findOne({});
  assert.equal(r2.lovedBy.length, 0);
});

test("search finds the recipe and is noindex", async () => {
  const res = await request(app).get("/s?search=pancakes");
  assert.equal(res.status, 200);
  assert.match(res.text, /Buttermilk Pancakes/);
  assert.match(res.text, /noindex/);
});

test("public API returns recipe JSON", async () => {
  const res = await request(app).get("/api/v1/recipes");
  assert.equal(res.status, 200);
  assert.equal(res.body.total, 1);
  assert.equal(res.body.items[0].url, "https://example.test" + recipeUrl);
  const one = await request(app).get("/api/v1/recipes/grandma-s-buttermilk-pancakes-and-syrup");
  assert.equal(one.body["@type"], "Recipe");
});

test("sitemap includes the recipe", async () => {
  const res = await request(app).get("/sitemap.xml");
  assert.match(res.text, new RegExp(`<loc>https://example.test${recipeUrl}</loc>`));
});

test("another user cannot edit or delete the recipe", async () => {
  const other = request.agent(app);
  await other.post("/register").type("form").send({ username: "other@example.com", screenName: "other", firstName: "O", password: "supersecret1" });
  const res = await other.get(`${recipeUrl}/edit`);
  assert.equal(res.status, 302);
  assert.equal(res.headers.location, recipeUrl);
  const del = await other.delete(recipeUrl);
  assert.equal(del.status, 302);
  const Recipe = require("../models/recipe");
  assert.equal(await Recipe.countDocuments(), 1);
});

test("owner can edit and delete", async () => {
  const edit = await agent.get(`${recipeUrl}/edit`);
  assert.equal(edit.status, 200);
  assert.match(edit.text, /Best pancakes\.\n\nSecond paragraph/);
  const upd = await agent.put(recipeUrl).field("title", "Renamed").field("description", "x").field("prepTime", "5").field("cookTime", "5").field("category", "Dinner").field("ingredients[]", "a").field("directions[]", "b");
  assert.equal(upd.status, 302);
  assert.equal(upd.headers.location, recipeUrl, "slug stays stable on rename");
  const del = await agent.delete(recipeUrl);
  assert.equal(del.status, 302);
  const Recipe = require("../models/recipe");
  assert.equal(await Recipe.countDocuments(), 0);
});

test("forgot password sends token and reset works", async () => {
  await request(app).post("/forgot").type("form").send({ email: "palmer@example.com" }).expect(302);
  const User = require("../models/user");
  const user = await User.findOne({ username: "palmer@example.com" });
  assert.ok(user.resetPasswordToken);
  const fresh = request.agent(app);
  await fresh.post(`/reset/${user.resetPasswordToken}`).type("form").send({ password: "newpassword1", confirm: "newpassword1" }).expect(302);
  const login = await request.agent(app).post("/login").type("form").send({ username: "palmer@example.com", password: "newpassword1" });
  assert.equal(login.status, 302);
  assert.equal(login.headers.location, "/");
});

test("logout", async () => {
  const res = await agent.post("/logout");
  assert.equal(res.status, 302);
});
