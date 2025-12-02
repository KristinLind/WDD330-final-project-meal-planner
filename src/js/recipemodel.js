// src/js/recipemodel.js

import { settings } from "../../env.mjs";

// --- API endpoints ---
const THEMEALDB_SEARCH_URL =
    "https://www.themealdb.com/api/json/v1/1/search.php?s=";

const SPOONACULAR_SEARCH_URL =
    "https://api.spoonacular.com/recipes/complexSearch";

// --- Normalizers ---    
function normalizeMealDbMeal(meal) {
    return {
        id: meal.idMeal, // used for recipe-detail.html
        source: "themealdb",
        title: meal.strMeal,
        thumbnail: meal.strMealThumb,
        category: meal.strCategory,
        area: meal.strArea,
        instructions: meal.strInstructions,
    };
}

// Convert Spoonacular recipe to match MealDb
function normalizeSpoonacularRecipe(recipe) {
    return {
        id: `spoonacular-${recipe.id}`,
        source: "spoonacular",
        title: recipe.title,
        thumbnail: recipe.image,
        category: (recipe.dishTypes && recipe.dishTypes[0]) || "",
        area:
            (recipe.cuisines && recipe.cuisines[0]) ||
            "Spoonacular",
        instructions: recipe.summary
            ? recipe.summary.replace(/<[^>]+>/g, "")
            : "",
    };
}

// --- TheMealDB search ---
export async function searchMealDb(query) {
    const searchTerm = query && query.trim() ? query.trim() : "chicken";
    const url = THEMEALDB_SEARCH_URL + encodeURIComponent(searchTerm);

    const response = await fetch(url);
    if (!response.ok) {
        throw new Error("Failed to fetch recipes from TheMealDB");
    }

    const data = await response.json();
    if (!data.meals) {
        return [];
    }

    return data.meals.map(normalizeMealDbMeal);
}

// --- Spoonacular search ---
export async function searchSpoonacular(query, { number = 10 } = {}) {
    const apiKey = settings?.spoonacularKey;
    if (!apiKey) {
        console.warn("[recipemodel] No Spoonacular API key configured");
        return [];
    }

    const searchTerm = query && query.trim() ? query.trim() : "chicken";

    const url =
        `${SPOONACULAR_SEARCH_URL}` +
        `?apiKey=${encodeURIComponent(apiKey)}` +
        `&query=${encodeURIComponent(searchTerm)}` +
        `&number=${number}` +
        `&addRecipeInformation=true`;

    const response = await fetch(url);
    if (!response.ok) {
        throw new Error("Failed to fetch recipes from Spoonacular");
    }

    const data = await response.json();
    if (!data.results || !data.results.length) {
        return [];
    }

    return data.results.map(normalizeSpoonacularRecipe);
}

// --- Combined search ---
// For now, choose to use ONLY TheMealDB in the UI
// but keep Spoonacular results for later features (nutrition, etc.)
export async function searchRecipes(query) {
    const [mealDbResults, spoonacularResults] = await Promise.all([
        searchMealDb(query),
        searchSpoonacular(query, { number: 8 }).catch((err) => {
            console.warn("[recipemodel] Spoonacular error:", err);
            return [];
        }),
    ]);

    return {
        mealDb: mealDbResults,
        spoonacular: spoonacularResults,
    };
}
