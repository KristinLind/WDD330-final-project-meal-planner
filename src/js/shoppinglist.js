// src/js/shoppinglist.js 

// --- Config ---
const HEADER_PARTIAL_URL = "public/partials/header.html";
const FOOTER_PARTIAL_URL = "public/partials/footer.html";

const MEAL_PLAN_KEY = "mealPlanV1";
const EXTRA_ITEMS_KEY = "shoppingExtraV1";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MEALS = ["Breakfast", "Lunch", "Dinner"];

// -- Partial Loader -- 
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

// -- Storage Helpers --
function createEmptyPlan() {
    const plan = {};
    DAYS.forEach((day) => {
        MEALS.forEach((meal) => {
            const key = `${day.toLowerCase()}-${meal.toLowerCase()}`;
            plan[key] = "";
        });
    });
    return plan;
}

function loadPlanFromStorage() {
    try {
        const raw = localStorage.getItem(MEAL_PLAN_KEY);
        if (!raw) return createEmptyPlan();
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === "object" ? parsed : createEmptyPlan();
    } catch (e) {
        console.error("Error reading meal plan from localStorage", e);
        return createEmptyPlan();
    }
}

function loadExtraItemsFromStorage() {
    try {
        const raw = localStorage.getItem(EXTRA_ITEMS_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
        console.error("Error reading extra shopping items from localStorage", e);
        return [];
    }
}

function saveExtraItemsToStorage(items) {
    try {
        localStorage.setItem(EXTRA_ITEMS_KEY, JSON.stringify(items));
    } catch (e) {
        console.error("Error saving extra shopping items", e);
    }
}

// -- Transform Plan -> Shopping List --
function buildShoppingListFromPlan(plan) {
    const resultMap = new Map();

    DAYS.forEach((day) => {
        MEALS.forEach((meal) => {
            const key = `${day.toLowerCase()}-${meal.toLowerCase()}`;
            const recipeName = (plan[key] || "").trim();
            if (!recipeName) return;

            const normalized = recipeName.toLowerCase();
            if (!resultMap.has(normalized)) {
                resultMap.set(normalized, {
                    name: recipeName,
                    count: 0,
                    slots: [],
                });
            }

            const entry = resultMap.get(normalized);
            entry.count += 1;
            entry.slots.push({ day, meal });
        });
    });

// Convert to array, sort by name
    return Array.from(resultMap.values()).sort((a, b) =>
        a.name.localeCompare(b.name)
    );
}

// -- Rendering --
let currentPlan = loadPlanFromStorage();
let extraItems = loadExtraItemsFromStorage();

function renderShoppingList() {
    const root = document.querySelector("#shopping-list-root");
    if (!root) return;

    currentPlan = loadPlanFromStorage();
    extraItems = loadExtraItemsFromStorage();

    const aggregated = buildShoppingListFromPlan(currentPlan);

    const totalSlots = Object.values(currentPlan).filter(
        (value) => value && value.trim() !== ""
    ).length;

    const summaryHtml = `
    <section class="shopping-summary-card">
      <h2>Shopping Summary</h2>
      <p>
        Based on your current weekly meal plan, you have
        <strong>${totalSlots}</strong> planned meal slot${totalSlots === 1 ? "" : "s"
        }
        generating
        <strong>${aggregated.length}</strong> unique recipe item${aggregated.length === 1 ? "" : "s"
        }.
      </p>
      <p class="small-note">
        This list summarizes recipes by name. You can use it alongside your favorite grocery app
        or paper list.
      </p>
    </section>
  `;

    const itemsHtml = aggregated.length
        ? `
      <section class="shopping-group-card">
        <h2>Recipes from Meal Plan</h2>
        <ul class="shopping-list">
          ${aggregated
            .map((item) => {
                const slotText = item.slots
                    .map((slot) => `${slot.day} ${slot.meal}`)
                    .join(", ");

                return `
                <li class="shopping-item">
                  <div class="shopping-item-main">
                    <input type="checkbox" class="shopping-item-checkbox" />
                    <span class="shopping-item-name">${item.name}</span>
                    ${item.count > 1
                        ? `<span class="shopping-item-count">×${item.count}</span>`
                        : ""
                    }
                  </div>
                  <div class="shopping-item-meta">
                    From: ${slotText}
                  </div>
                </li>
              `;
            })
            .join("")}
        </ul>
      </section>
    `
        : `
      <section class="shopping-group-card">
        <h2>Recipes from Meal Plan</h2>
        <p class="small-note">
          No recipes found in your current meal plan. Add meals to the planner first, then come back here.
        </p>
      </section>
    `;

    const extraItemsHtml = `
    <section class="shopping-group-card">
      <h2>Additional Items</h2>
      <form id="extra-item-form" class="extra-item-form">
        <label for="extra-item-input" class="sr-only">Add item</label>
        <input
          type="text"
          id="extra-item-input"
          placeholder="Add an extra item (e.g., milk, eggs, snacks)…"
          autocomplete="off"
        />
        <button type="submit" class="btn-secondary">Add</button>
      </form>

      ${extraItems.length
            ? `
            <ul class="shopping-list extra-items-list">
              ${extraItems
                .map(
                    (item) => `
                <li class="shopping-item" data-id="${item.id}">
                  <div class="shopping-item-main">
                    <input
                      type="checkbox"
                      class="extra-item-checkbox"
                      ${item.checked ? "checked" : ""}
                    />
                    <span class="shopping-item-name ${item.checked ? "checked" : ""
                        }">${item.name}</span>
                    <button type="button" class="extra-item-remove" aria-label="Remove item">
                      ✕
                    </button>
                  </div>
                </li>
              `
                )
                .join("")}
            </ul>
          `
            : `<p class="small-note">No extra items yet. Add anything you need that isn't tied to a recipe.</p>`
        }
    </section>
  `;

    root.innerHTML = `
    <div class="shopping-layout">
      ${summaryHtml}
      ${itemsHtml}
      ${extraItemsHtml}
    </div>
  `;

    attachShoppingEvents();
}

function attachShoppingEvents() {
    const form = document.querySelector("#extra-item-form");
    const input = document.querySelector("#extra-item-input");
    const extraList = document.querySelector(".extra-items-list");

    if (form && input) {
        form.addEventListener("submit", (event) => {
            event.preventDefault();
            const value = input.value.trim();
            if (!value) return;

            extraItems.push({
                id: Date.now().toString(),
                name: value,
                checked: false,
            });

            saveExtraItemsToStorage(extraItems);
            input.value = "";
            renderShoppingList();
        });
    }

    if (extraList) {
        // Event delegation for checkboxes and remove buttons
        extraList.addEventListener("click", (event) => {
            const li = event.target.closest(".shopping-item");
            if (!li) return;
            const id = li.dataset.id;
            if (!id) return;

            // Toggle checked
            if (event.target.classList.contains("extra-item-checkbox")) {
                extraItems = extraItems.map((item) =>
                    item.id === id ? { ...item, checked: !item.checked } : item
                );
                saveExtraItemsToStorage(extraItems);
                renderShoppingList();
            }

            // Remove item
            if (event.target.classList.contains("extra-item-remove")) {
                extraItems = extraItems.filter((item) => item.id !== id);
                saveExtraItemsToStorage(extraItems);
                renderShoppingList();
            }
        });
    }
}

// -- MAIN INIT --
async function init() {
    await Promise.all([
        loadPartial("#site-header", HEADER_PARTIAL_URL),
        loadPartial("#site-footer", FOOTER_PARTIAL_URL),
    ]);

    renderShoppingList();
}

init();