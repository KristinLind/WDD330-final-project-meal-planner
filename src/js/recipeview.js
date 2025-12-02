// src/js/recipeview.js
import { settings } from "../../env.mjs";

// --- CONFIG / ENDPOINTS ---
const THEMEALDB_LOOKUP_URL =
  "https://www.themealdb.com/api/json/v1/1/lookup.php?i=";

const SPOONACULAR_INFO_BASE = "https://api.spoonacular.com/recipes";

const HEADER_PARTIAL_URL = "/partials/header.html";
const FOOTER_PARTIAL_URL = "/partials/footer.html";

const SAVED_RECIPES_KEY = "savedRecipesV1";
const SHOPPING_EXTRAS_KEY = "shoppingExtrasV1";

// --- Partial Loader ---
async function loadPartial(selector, url) {
  const container = document.querySelector(selector);
  if (!container) return;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to load partial: ${url}`);
    }
    const html = await response.text();
    container.innerHTML = html;
  } catch (error) {
    console.error(error);
    container.innerHTML =
      "<p class='error'>Sorry, we couldn’t load this section.</p>";
  }
}

// --- Status helper ---
function renderStatus(message, type = "info") {
  const statusEl = document.querySelector("#status");
  if (!statusEl) {
    if (message) console.log("[recipe-detail]", message);
    return;
  }

  if (!message) {
    statusEl.textContent = "";
    statusEl.className = "status-message";
    return;
  }

  statusEl.textContent = message;
  statusEl.className = `status-message ${type}`;
}

// --- URL helper: detect source + id ---
function getRecipeRequestFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const idParam = params.get("id");
  if (!idParam) return null;

  if (idParam.startsWith("spoonacular-")) {
    return {
      source: "spoonacular",
      id: idParam.replace("spoonacular-", ""),
    };
  }

  return {
    source: "themealdb",
    id: idParam,
  };
}

// ---  NORMALIZATION HELPERS ---

// MealDB ingredients
function buildMealDbIngredients(meal) {
  const ingredients = [];

  for (let i = 1; i <= 20; i++) {
    const ing = meal[`strIngredient${i}`];
    const measure = meal[`strMeasure${i}`];

    if (ing && ing.trim() !== "") {
      ingredients.push({
        ingredient: ing.trim(),
        measure: measure ? measure.trim() : "",
      });
    }
  }

  return ingredients;
}

function normalizeMealDbDetail(meal) {
  return {
    id: meal.idMeal,
    source: "themealdb",
    title: meal.strMeal,
    image: meal.strMealThumb,
    area: meal.strArea || "",
    category: meal.strCategory || "",
    instructionsHtml: meal.strInstructions
      ? meal.strInstructions.replace(/\r\n/g, "<br>")
      : "",
    ingredients: buildMealDbIngredients(meal),
    nutrition: [],
    servings: null,
    readyInMinutes: null,
    sourceUrl: "",
  };
}

// Spoonacular ingredients
function buildSpoonacularIngredients(recipe) {
  if (!recipe.extendedIngredients) return [];

  return recipe.extendedIngredients.map((ing) => {
    const name = ing.originalName || ing.name || "";
    const measure =
      ing.original ||
      `${ing.amount || ""} ${ing.unit || ""}`.trim();

    return {
      ingredient: name,
      measure: measure,
    };
  });
}

// Spoonacular nutrition
function buildSpoonacularNutrition(recipe) {
  const nutrients = recipe.nutrition && recipe.nutrition.nutrients;
  if (!nutrients || !nutrients.length) return [];

  const wanted = ["Calories", "Protein", "Carbohydrates", "Fat"];

  return nutrients
    .filter((n) => wanted.includes(n.name))
    .map((n) => ({
      label: n.name,
      value: Math.round(n.amount),
      unit: n.unit,
    }));
}

function normalizeSpoonacularDetail(recipe) {
  return {
    id: `spoonacular-${recipe.id}`,
    source: "spoonacular",
    title: recipe.title,
    image: recipe.image,
    area:
      (recipe.cuisines && recipe.cuisines.length
        ? recipe.cuisines[0]
        : "Spoonacular") || "",
    category:
      (recipe.dishTypes && recipe.dishTypes.length
        ? recipe.dishTypes[0]
        : "") || "",
    instructionsHtml:
      recipe.instructions ||
      (recipe.summary
        ? recipe.summary.replace(/<[^>]+>/g, "")
        : "No instructions provided."),
    ingredients: buildSpoonacularIngredients(recipe),
    nutrition: buildSpoonacularNutrition(recipe),
    servings: recipe.servings || null,
    readyInMinutes: recipe.readyInMinutes || null,
    sourceUrl:
      recipe.sourceUrl ||
      recipe.spoonacularSourceUrl ||
      "",
  };
}

// --- FETCH HELPERS ---

async function fetchMealDbById(id) {
  const url = THEMEALDB_LOOKUP_URL + encodeURIComponent(id);
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error("Failed to fetch recipe details from TheMealDB");
  }

  const data = await response.json();
  if (!data.meals || !data.meals.length) {
    return null;
  }

  return normalizeMealDbDetail(data.meals[0]);
}

async function fetchSpoonacularById(id) {
  const apiKey = settings?.spoonacularKey;
  if (!apiKey) {
    throw new Error("No Spoonacular API key configured");
  }

  const url =
    `${SPOONACULAR_INFO_BASE}/${encodeURIComponent(
      id
    )}/information?includeNutrition=true&apiKey=${encodeURIComponent(
      apiKey
    )}`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error("Failed to fetch recipe details from Spoonacular");
  }

  const data = await response.json();
  return normalizeSpoonacularDetail(data);
}

// ---  LOCALSTORAGE: SAVE RECIPE ---

function loadSavedRecipes() {
  try {
    const raw = localStorage.getItem(SAVED_RECIPES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.error("[recipe-detail] error reading saved recipes", e);
    return [];
  }
}

function saveSavedRecipes(list) {
  try {
    localStorage.setItem(SAVED_RECIPES_KEY, JSON.stringify(list));
  } catch (e) {
    console.error("[recipe-detail] error saving recipes", e);
  }
}

// --- SHOPPING LIST HELPERS ---

function loadShoppingExtras() {
  try {
    const raw = localStorage.getItem(SHOPPING_EXTRAS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.error("[recipe-detail] error reading shopping extras", e);
    return [];
  }
}

function saveShoppingExtras(list) {
  try {
    localStorage.setItem(SHOPPING_EXTRAS_KEY, JSON.stringify(list));
  } catch (e) {
    console.error("[recipe-detail] error saving shopping extras", e);
  }
}

function addRecipeIngredientsToShoppingList(recipe) {
  const extras = loadShoppingExtras();

  const newItems = (recipe.ingredients || []).map((item) => ({
    name: item.ingredient,
    measure: item.measure,
    fromRecipeId: recipe.id,
    fromRecipeTitle: recipe.title,
  }));

  const combined = [...extras, ...newItems];
  saveShoppingExtras(combined);
}

// --- SAVE BUTTON ---

function setupSaveButton(recipe) {
  const btn = document.querySelector("#save-recipe-button");
  if (!btn) return;

  function isSaved(list) {
    return list.some((r) => r.id === recipe.id);
  }

  function updateLabel(list) {
    btn.textContent = isSaved(list) ? "Remove from Saved" : "Save Recipe";
  }

  let savedList = loadSavedRecipes();
  updateLabel(savedList);

  btn.addEventListener("click", () => {
    savedList = loadSavedRecipes();

    if (isSaved(savedList)) {
      // remove
      savedList = savedList.filter((r) => r.id !== recipe.id);
    } else {
      // add minimal summary
      savedList.push({
        id: recipe.id,
        source: recipe.source,
        title: recipe.title,
        image: recipe.image,
        area: recipe.area,
        category: recipe.category,
      });
    }

    saveSavedRecipes(savedList);
    updateLabel(savedList);
  });
}

// --- RENDERING ---

function renderRecipeDetail(recipe) {
  const container = document.querySelector("#recipe-detail");
  if (!container) return;

  const ingredientsHTML = (recipe.ingredients || [])
    .map(
      (item) => `
        <li>
          <span class="ingredient-name">${item.ingredient}</span>
          ${item.measure
          ? `<span class="ingredient-measure">${item.measure}</span>`
          : ""
        }
        </li>
      `
    )
    .join("");

  const nutritionHTML =
    recipe.nutrition && recipe.nutrition.length
      ? `
      <section class="recipe-nutrition">
        <h2>Nutrition (per serving)</h2>
        <ul class="nutrition-list">
          ${recipe.nutrition
        .map(
          (n) => `
            <li>
              <span class="nutrient-name">${n.label}</span>
              <span class="nutrient-value">${n.value} ${n.unit}</span>
            </li>
          `
        )
        .join("")}
        </ul>
      </section>
    `
      : "";

  container.innerHTML = `
    <article class="recipe-detail-card">
      <header class="recipe-detail-header">
        <h1>${recipe.title}</h1>

        <div class="recipe-meta recipe-meta-tags">
          ${recipe.area
      ? `<a class="recipe-tag" href="index.html?search=${encodeURIComponent(
        recipe.area
      )}">${recipe.area}</a>`
      : ""
    }
          ${recipe.category
      ? `<a class="recipe-tag" href="index.html?search=${encodeURIComponent(
        recipe.category
      )}">${recipe.category}</a>`
      : ""
    }
        </div>

        <div class="recipe-meta recipe-meta-extra">
          ${recipe.servings
      ? `<span><strong>Servings:</strong> ${recipe.servings}</span>`
      : ""
    }
          ${recipe.readyInMinutes
      ? `<span><strong>Ready in:</strong> ${recipe.readyInMinutes
      } min</span>`
      : ""
    }
        </div>

        ${recipe.sourceUrl
      ? `
          <p class="recipe-source">
            Original recipe:
            <a href="${recipe.sourceUrl}" target="_blank" rel="noopener noreferrer">
              View on source site
            </a>
          </p>
        `
      : ""
    }

        <button
          id="save-recipe-button"
          class="btn-secondary save-recipe-button"
          type="button"
        >
          Save Recipe
        </button>
      </header>

      <div class="recipe-detail-layout">
        <div class="recipe-detail-image">
          <img src="${recipe.image}" alt="${recipe.title}" loading="lazy" />
        </div>

        <section class="recipe-detail-main">
          <h2>Ingredients</h2>

          <button
            id="add-to-shopping-list"
            class="btn-secondary add-to-shopping-btn"
            type="button"
          >
            Add Ingredients to Shopping List
          </button>

          <ul class="ingredients-list">
            ${ingredientsHTML}
          </ul>

          <h2>Instructions</h2>
          <p class="instructions">
            ${recipe.instructionsHtml || "No instructions provided."}
          </p>

          ${nutritionHTML}

          <p class="back-link">
            <a href="index.html">&larr; Back to recipe search</a>
          </p>
        </section>
      </div>
    </article>
  `;

  // Wire up the Save button
  setupSaveButton(recipe);

  // Wire up "Add to shopping list" button
  const addBtn = document.querySelector("#add-to-shopping-list");
  if (addBtn) {
    addBtn.addEventListener("click", () => {
      addRecipeIngredientsToShoppingList(recipe);
      alert("Ingredients added to your shopping list!");
    });
  }
}

// --- MAIN INIT ---

async function init() {
  console.log("[recipe-detail] recipeview.js loaded");

  // Load header + footer first
  await Promise.all([
    loadPartial("#site-header", HEADER_PARTIAL_URL),
    loadPartial("#site-footer", FOOTER_PARTIAL_URL),
  ]);

  const request = getRecipeRequestFromUrl();
  if (!request) {
    renderStatus(
      "No recipe selected. Please go back and choose a recipe.",
      "error"
    );
    return;
  }

  try {
    renderStatus("Loading recipe details…", "loading");

    let recipe;
    if (request.source === "spoonacular") {
      recipe = await fetchSpoonacularById(request.id);
    } else {
      recipe = await fetchMealDbById(request.id);
    }

    if (!recipe) {
      renderStatus("Recipe not found. It may have been removed.", "error");
      return;
    }

    renderRecipeDetail(recipe);
    renderStatus("");
  } catch (error) {
    console.error(error);
    renderStatus(
      "Something went wrong while loading this recipe. Please try again.",
      "error"
    );
  }
}

init();
