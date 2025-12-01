// src/js/recipeview.js

// --- Config ---
const THEMEALDB_LOOKUP_URL =
    "https://www.themealdb.com/api/json/v1/1/lookup.php?i=";

const HEADER_PARTIAL_URL = "/partials/header.html";
const FOOTER_PARTIAL_URL = "/partials/footer.html";

// Partial Loader ---
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

// --- Utilities --
function getMealIdFromUrl() {
    const params = new URLSearchParams(window.location.search);
    return params.get("id");
}

function buildIngredientsList(meal) {
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

function renderStatus(message, type = "info") {
    const statusEl = document.querySelector("#status");
    if (!statusEl) {
        // Optional fallback: log to console if no status element
        if (message) console.log(`[recipe-detail] ${message}`);
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

// ================== API ==================
async function fetchMealById(id) {
    const url = THEMEALDB_LOOKUP_URL + encodeURIComponent(id);
    const response = await fetch(url);

    if (!response.ok) {
        throw new Error("Failed to fetch recipe details from TheMealDB");
    }

    const data = await response.json();
    if (!data.meals || !data.meals.length) {
        return null;
    }

    return data.meals[0];
}

// ================== RENDERING ==================
function renderMealDetail(meal) {
    const container = document.querySelector("#recipe-detail");
    if (!container) return;

    const ingredients = buildIngredientsList(meal);

    const ingredientsHTML = ingredients
        .map(
            (item) => `
        <li>
          <span class="ingredient-name">${item.ingredient}</span>
          ${item.measure ? `<span class="ingredient-measure">${item.measure}</span>` : ""}
        </li>
      `
        )
        .join("");

    container.innerHTML = `
    <article class="recipe-detail-card">
      <header class="recipe-detail-header">
        <h1>${meal.strMeal}</h1>
        <p class="recipe-meta">
          ${meal.strArea ? `<span>${meal.strArea}</span>` : ""}
          ${meal.strCategory ? `<span>${meal.strCategory}</span>` : ""}
        </p>
      </header>

      <div class="recipe-detail-layout">
        <div class="recipe-detail-image">
          <img src="${meal.strMealThumb}" alt="${meal.strMeal}" loading="lazy" />
        </div>

        <section class="recipe-detail-main">
          <h2>Ingredients</h2>
          <ul class="ingredients-list">
            ${ingredientsHTML}
          </ul>

          <h2>Instructions</h2>
          <p class="instructions">
            ${meal.strInstructions ? meal.strInstructions.replace(/\r\n/g, "<br>") : ""}
          </p>

          ${meal.strSource
            ? `<p class="recipe-source">Source: <a href="${meal.strSource}" target="_blank" rel="noopener noreferrer">${meal.strSource}</a></p>`
            : ""
        }

          <p class="back-link">
            <a href="index.html">&larr; Back to recipe search</a>
          </p>
        </section>
      </div>
    </article>
  `;
}
// -- Main Init ---
async function init() {
    // Load header + footer
    await Promise.all([
        loadPartial("#site-header", HEADER_PARTIAL_URL),
        loadPartial("#site-footer", FOOTER_PARTIAL_URL),
    ]);

    const id = getMealIdFromUrl();
    if (!id) {
        renderStatus("No recipe selected. Please go back and choose a recipe.", "error");
        return;
    }

    try {
        renderStatus("Loading recipe details…", "loading");
        const meal = await fetchMealById(id);

        if (!meal) {
            renderStatus("Recipe not found. It may have been removed.", "error");
            return;
        }

        renderMealDetail(meal);
        renderStatus("");
    } catch (error) {
        console.error(error);
        renderStatus(
            "Something went wrong while loading this recipe. Please try again.",
            "error"
        );
    }
}

// launch 
init();