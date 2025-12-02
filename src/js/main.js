// src/js/main.js
import { searchRecipes } from "./recipemodel.js";

// localStorage key must match recipeview.js
const SAVED_RECIPES_KEY = "savedRecipesV1";

// --- PARTIAL LOADER ---
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
      "<p class='error'>Sorry, we couldn't load this section.</p>";
  }
}

// --- STATUS / MESSAGES ---
function renderStatus(message, type = "info") {
  const statusEl = document.querySelector("#status");
  if (!statusEl) return;

  if (!message) {
    statusEl.textContent = "";
    statusEl.className = "status-message";
    return;
  }

  statusEl.textContent = message;
  statusEl.className = `status-message ${type}`;
}

// --- SEARCH RESULT CARDS ---
function renderRecipes(recipes) {
  const container = document.querySelector("#results");
  if (!container) return;

  if (!recipes.length) {
    container.innerHTML =
      "<p class='no-results'>No recipes found. Try a different search term.</p>";
    return;
  }

  const cardsHTML = recipes
    .map(
      (recipe) => `
        <article class="recipe-card fade-in">
          <img
            src="${recipe.thumbnail}"
            alt="${recipe.title}"
            loading="lazy"
          />
          <div class="recipe-card-body">
            <h2>${recipe.title}</h2>
            <p class="recipe-meta">
              ${recipe.area ? `<span>${recipe.area}</span>` : ""}
              ${recipe.category ? `<span>${recipe.category}</span>` : ""}
            </p>
            <p class="recipe-excerpt">
              ${recipe.instructions
          ? recipe.instructions.slice(0, 120) + "..."
          : ""
        }
            </p>
            <a
              href="recipe-detail.html?id=${encodeURIComponent(recipe.id)}"
              class="btn-secondary"
            >
              View Details
            </a>
          </div>
        </article>
      `
    )
    .join("");

  container.innerHTML = cardsHTML;
}

// --- SAVED RECIPES HELPERS ---
function loadSavedRecipes() {
  try {
    const raw = localStorage.getItem(SAVED_RECIPES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.error("[main] error reading saved recipes", e);
    return [];
  }
}

function renderSavedRecipes() {
  const section = document.querySelector("#saved-recipes");
  if (!section) return;

  const saved = loadSavedRecipes();
  console.log("[home] saved recipes from storage:", saved);

  if (!saved.length) {
    section.innerHTML = `
      <h2>Your Saved Recipes</h2>
      <p class="small-note">
        You haven't saved any recipes yet.
        Open a recipe detail and click <strong>"Save Recipe"</strong> to add it here.
      </p>
    `;
    return;
  }

  const cardsHTML = saved
    .map(
      (recipe) => `
        <article class="recipe-card saved-recipe-card">
          <img
            src="${recipe.image || recipe.thumbnail || ""}"
            alt="${recipe.title}"
            loading="lazy"
          />
          <div class="recipe-card-body">
            <h2>${recipe.title}</h2>
            <p class="recipe-meta">
              ${recipe.area ? `<span>${recipe.area}</span>` : ""}
              ${recipe.category ? `<span>${recipe.category}</span>` : ""}
            </p>
            <a
              href="recipe-detail.html?id=${encodeURIComponent(recipe.id)}"
              class="btn-secondary"
            >
              View Details
            </a>
          </div>
        </article>
      `
    )
    .join("");

  section.innerHTML = `
    <div class="saved-recipes-header">
      <h2>Saved Recipes</h2>
      <button id="clear-saved-btn" class="clear-saved-btn">
        Clear All Saved Recipes
      </button>
    </div>
    <div class="recipe-list saved-recipes-grid">
      ${cardsHTML}
    </div>
  `;

  // attach clear button handler every time we re-render
  const clearBtn = section.querySelector("#clear-saved-btn");
  if (clearBtn) {
    clearBtn.addEventListener("click", () => {
      if (!confirm("Delete all saved recipes?")) return;

      localStorage.removeItem(SAVED_RECIPES_KEY);
      renderSavedRecipes(); // re-render as “empty”
    });
  }
}

// -- MAIN INIT --
async function init() {
  console.log("[main] main.js loaded");

  // 1. Load header + footer partials
  await Promise.all([
    loadPartial("#site-header", "/partials/header.html"),
    loadPartial("#site-footer", "/partials/footer.html"),
  ]);

  // 2. Initialize mobile nav
  function initNavToggle() {
    const toggle = document.querySelector(".nav-toggle");
    const nav = document.querySelector(".site-nav");

    if (!toggle || !nav) return;

    toggle.addEventListener("click", () => {
      const isOpen = nav.classList.toggle("is-open");
      toggle.setAttribute("aria-expanded", String(isOpen));
    });
  }

  initNavToggle();

  console.log("[main] init() starting");

  // 3. Show any saved recipes
  renderSavedRecipes();

  // 4. Search form
  const form = document.querySelector("#search-form");
  const input = document.querySelector("#search-input");

  if (form && input) {
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const query = input.value;

      try {
        renderStatus("Searching recipes…", "loading");

        const { mealDb, spoonacular } = await searchRecipes(query);

        console.log("[Search MealDB]", mealDb);
        console.log("[Search Spoonacular]", spoonacular);

        const combined = [...mealDb, ...spoonacular];

        renderRecipes(combined);

        renderStatus(
          combined.length
            ? `Showing ${combined.length} result(s) for "${query || "chicken"}".`
            : `No results found for "${query}".`,
          "info"
        );
      } catch (error) {
        console.error(error);
        renderStatus(
          "Something went wrong while searching for recipes.",
          "error"
        );
      }
    });
  }

  // 5. Initial load: show default recipes or tag search from URL
  try {
    const params = new URLSearchParams(window.location.search);
    const initialSearch = params.get("search") || "chicken";

    if (input) {
      input.value = initialSearch;
    }

    renderStatus("Loading recipes…", "loading");
    const { mealDb, spoonacular } = await searchRecipes(initialSearch);
    console.log("[Initial MealDB]", mealDb);
    console.log("[Initial Spoonacular]", spoonacular);
    const combined = [...mealDb, ...spoonacular];
    renderRecipes(combined);
    renderStatus(`Showing results for "${initialSearch}".`, "info");
  } catch (error) {
    console.error(error);
    renderStatus(
      "Something went wrong while loading initial recipes.",
      "error"
    );
  }
}

init();

