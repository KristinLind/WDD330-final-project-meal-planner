// src/js/main.js
// --- CONFIG ---
const THEMEALDB_SEARCH_URL =
    "https://www.themealdb.com/api/json/v1/1/search.php?s=";

// const SPOONACULAR_API_KEY = "YOUR_KEY_HERE";

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
            "<p class='error'>Sorry, we couldn’t load this section.</p>";
    }
}

// --- API + DATA ---
async function searchMeals(query) {
    // If no query, show something simple like "chicken" by default
    const searchTerm = query && query.trim() ? query.trim() : "chicken";
    const url = THEMEALDB_SEARCH_URL + encodeURIComponent(searchTerm);

    const response = await fetch(url);
    if (!response.ok) {
        throw new Error("Failed to fetch recipes from TheMealDB");
    }

    const data = await response.json();

    // TheMealDB returns { meals: [...] } or { meals: null }
    if (!data.meals) {
        return [];
    }

    // Normalize the data - simplify
    return data.meals.map((meal) => ({
        id: meal.idMeal,
        title: meal.strMeal,
        thumbnail: meal.strMealThumb,
        category: meal.strCategory,
        area: meal.strArea,
        instructions: meal.strInstructions,
    }));
}

// --- RENDERING 
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
                    : ""}
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

// -- MAIN INIT --
async function init() {
    // 1. Load header + footer partials
    await Promise.all([
        loadPartial("#site-header", "/partials/header.html"),
        loadPartial("#site-footer", "/partials/footer.html"),
    ]);

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

    // 2. Wire up search form
    const form = document.querySelector("#search-form");
    const input = document.querySelector("#search-input");

    if (form && input) {
        form.addEventListener("submit", async (event) => {
            event.preventDefault();
            const query = input.value;

            try {
                renderStatus("Searching recipes…", "loading");
                const recipes = await searchMeals(query);
                renderRecipes(recipes);
                renderStatus(
                    recipes.length
                        ? `Showing ${recipes.length} result(s) for "${query || "chicken"}".`
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

    // 3. Initial load: show default recipes (e.g., chicken)
    try {
        renderStatus("Loading recipes…", "loading");
        const initialRecipes = await searchMeals("chicken");
        renderRecipes(initialRecipes);
        renderStatus('Showing results for "chicken".', "info");
    } catch (error) {
        console.error(error);
        renderStatus(
            "Something went wrong while loading initial recipes.",
            "error"
        );
    }
}

init();
