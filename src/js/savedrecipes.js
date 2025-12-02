// src/js/savedrecipes.js

const SAVED_RECIPES_KEY = "savedRecipesV1";

// --- PARTIAL LOADER (same pattern as main.js) ---
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

// --- MOBILE NAV TOGGLE (copy from main.js) ---
function initNavToggle() {
    const toggle = document.querySelector(".nav-toggle");
    const nav = document.querySelector(".site-nav");

    if (!toggle || !nav) return;

    toggle.addEventListener("click", () => {
        const isOpen = nav.classList.toggle("is-open");
        toggle.setAttribute("aria-expanded", String(isOpen));
    });
}

// --- LOCALSTORAGE HELPERS ---
function loadSavedRecipes() {
    try {
        const raw = localStorage.getItem(SAVED_RECIPES_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
        console.error("[saved page] error reading saved recipes", e);
        return [];
    }
}

function saveSavedRecipes(list) {
    try {
        localStorage.setItem(SAVED_RECIPES_KEY, JSON.stringify(list));
    } catch (e) {
        console.error("[saved page] error saving recipes", e);
    }
}

// --- RENDERING ---
function renderSavedRecipes() {
    const container = document.querySelector("#saved-recipes");
    const clearBtn = document.querySelector("#clear-saved-btn");
    if (!container) return;

    const saved = loadSavedRecipes();
    console.log("[saved page] saved recipes from storage:", saved);

    if (!saved.length) {
        container.innerHTML = `
      <p class="small-note">
        You haven't saved any recipes yet.
        Go back to the <a href="index.html">Home page</a> to search and save recipes.
      </p>
    `;
        if (clearBtn) clearBtn.disabled = true;
        return;
    }

    if (clearBtn) clearBtn.disabled = false;

    container.innerHTML = saved
        .map(
            (recipe) => `
        <article class="recipe-card saved-recipe-card" data-id="${recipe.id}">
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
            <div class="saved-card-actions">
              <a
                href="recipe-detail.html?id=${encodeURIComponent(recipe.id)}"
                class="btn-secondary"
              >
                View Details
              </a>
              <button
                type="button"
                class="btn-secondary remove-saved-btn"
                data-id="${recipe.id}"
              >
                Remove
              </button>
            </div>
          </div>
        </article>
      `
        )
        .join("");

    // Attach per-card remove handlers
    container.querySelectorAll(".remove-saved-btn").forEach((btn) => {
        btn.addEventListener("click", () => {
            const id = btn.dataset.id;
            const updated = loadSavedRecipes().filter((r) => r.id !== id);
            saveSavedRecipes(updated);
            renderSavedRecipes();
        });
    });
}

// --- CLEAR ALL BUTTON ---
function initClearAllButton() {
    const clearBtn = document.querySelector("#clear-saved-btn");
    if (!clearBtn) return;

    clearBtn.addEventListener("click", () => {
        if (!confirm("Delete all saved recipes?")) return;
        localStorage.removeItem(SAVED_RECIPES_KEY);
        renderSavedRecipes();
    });
}

// --- INIT ---
async function init() {
    await Promise.all([
        loadPartial("#site-header", "/partials/header.html"),
        loadPartial("#site-footer", "/partials/footer.html"),
    ]);

    initNavToggle();
    renderSavedRecipes();
    initClearAllButton();
}

init();
