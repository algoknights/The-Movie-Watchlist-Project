const API_KEY = "7015cea";

const searchInput = document.getElementById("searchInput");
const typeFilter = document.getElementById("typeFilter");
const genreFilter = document.getElementById("genreFilter");
const ratingFilter = document.getElementById("ratingFilter");
const yearFilter = document.getElementById("yearFilter");
const favoritesOnly = document.getElementById("favoritesOnly");
const sortBy = document.getElementById("sortBy");
const themeToggle = document.getElementById("themeToggle");

const moviesContainer = document.getElementById("moviesContainer");
const loader = document.getElementById("loader");
const infiniteScrollSpinner = document.getElementById("infiniteScrollSpinner");
const emptyState = document.getElementById("emptyState");

let currentQuery = "";
let currentPage = 1;
let isFetching = false;
let hasMore = true;

// We store complete movie objects along with their expanded details
let allLoadedMovies = [];
let expandedImdbId = null;

// Utility functions
const safeJsonParse = (value, fallback) => {
  try { return JSON.parse(value) ?? fallback; }
  catch { return fallback; }
};

const getFavoritesSet = () => new Set(safeJsonParse(localStorage.getItem("favorites"), []));
const setFavoritesSet = (favsSet) => localStorage.setItem("favorites", JSON.stringify([...favsSet]));

const normalize = (text) => String(text ?? "").trim().toLowerCase();

const parseYear = (movieYear) => {
  const match = String(movieYear ?? "").match(/\d{4}/);
  return match ? Number(match[0]) : null;
};

const parseRating = (rating) => {
  const r = Number.parseFloat(rating);
  return Number.isNaN(r) ? 0 : r;
};

// Throttle for scroll performance
const throttle = (func, limit) => {
  let inThrottle;
  return function(...args) {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
};

// Debounce for input performance
const debounce = (func, delay) => {
  let timeout;
  return function (...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), delay);
  };
};

/* API Calls */
const fetchSearchPage = async (query, page = 1) => {
  const res = await fetch(`https://www.omdbapi.com/?apikey=${API_KEY}&s=${encodeURIComponent(query)}&page=${page}`);
  return await res.json();
};

const fetchMovieDetails = async (imdbID) => {
  try {
    const res = await fetch(`https://www.omdbapi.com/?apikey=${API_KEY}&i=${encodeURIComponent(imdbID)}&plot=short`);
    return await res.json();
  } catch {
    return null;
  }
};

const fetchAndAppendMovies = async (query, page) => {
  if (isFetching || !hasMore) return;
  isFetching = true;
  
  if (page === 1) {
    loader.classList.remove("hidden");
    emptyState.classList.add("hidden");
    moviesContainer.innerHTML = "";
    allLoadedMovies = [];
  } else {
    infiniteScrollSpinner.classList.remove("hidden");
  }

  try {
    const data = await fetchSearchPage(query, page);
    
    if (data.Response === "False") {
      hasMore = false;
      if (page === 1) render(); 
      return;
    }

    const searchResults = Array.isArray(data.Search) ? data.Search : [];
    
    // Fetch details concurrently for all results to enable deep filtering
    const detailedMovies = await Promise.all(
      searchResults.map(async (basicMovie) => {
        const details = await fetchMovieDetails(basicMovie.imdbID);
        return { ...basicMovie, ...details }; 
      })
    );
    
    const existingIds = new Set(allLoadedMovies.map(m => m.imdbID));
    const newUniqueMovies = detailedMovies.filter(m => !existingIds.has(m.imdbID));

    allLoadedMovies = [...allLoadedMovies, ...newUniqueMovies];
    
    const totalResults = Number(data.totalResults) || 0;
    if (allLoadedMovies.length >= totalResults) {
      hasMore = false;
    }

  } catch (err) {
    console.error("Failed to fetch movies:", err);
  } finally {
    isFetching = false;
    if (page === 1) loader.classList.add("hidden");
    infiniteScrollSpinner.classList.add("hidden");
    render();
  }
};

// Listeners
searchInput.addEventListener("input", debounce((e) => {
  currentQuery = e.target.value.trim();
  currentPage = 1;
  hasMore = true;
  if (!currentQuery) {
    allLoadedMovies = [];
    render();
  } else {
    fetchAndAppendMovies(currentQuery, currentPage);
  }
}, 500));

// Infinite Scroll logic
window.addEventListener("scroll", throttle(() => {
  if (!currentQuery || isFetching || !hasMore) return;
  const currScroll = window.innerHeight + window.scrollY;
  if (currScroll >= document.documentElement.scrollHeight - 300) {
    currentPage++;
    fetchAndAppendMovies(currentQuery, currentPage);
  }
}, 250));

/* Data Transformation with Array Higher-Order Functions */
const applySearchFilterSort = (movies) => {
  const type = typeFilter.value;
  const genre = genreFilter.value;
  const ratingStat = ratingFilter.value;
  const yearStat = yearFilter.value;
  const favsOnly = favoritesOnly.checked;
  const sort = sortBy.value;
  const favs = getFavoritesSet();

  const filtered = movies
    .filter(m => type === "all" ? true : m.Type === type)
    .filter(m => genre === "all" || normalize(m.Genre).includes(normalize(genre)))
    .filter(m => ratingStat === "all" || parseRating(m.imdbRating) >= Number(ratingStat))
    .filter(m => {
      if (yearStat === "all") return true;
      const y = parseYear(m.Year);
      if (!y) return false;
      if (yearStat === "2020s") return y >= 2020 && y <= 2029;
      if (yearStat === "2010s") return y >= 2010 && y <= 2019;
      if (yearStat === "2000s") return y >= 2000 && y <= 2009;
      if (yearStat === "older") return y < 2000;
      return true;
    })
    .filter(m => favsOnly ? favs.has(m.imdbID) : true);

  return [...filtered].sort((a, b) => {
    if (sort === "title-asc") return a.Title.localeCompare(b.Title);
    if (sort === "title-desc") return b.Title.localeCompare(a.Title);
    if (sort === "rating-desc") return parseRating(b.imdbRating) - parseRating(a.imdbRating);
    
    const ay = parseYear(a.Year) ?? 0;
    const by = parseYear(b.Year) ?? 0;
    if (sort === "year-asc") return ay - by;
    if (sort === "year-desc") return by - ay;
    
    return 0; // fallback to relevance
  });
};

/* Rendering Process */
const escapeHtml = (text) => {
  return String(text ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
};

const getPosterSrc = (url) => (url && url !== "N/A" ? url : "");

const render = () => {
  const moviesToShow = applySearchFilterSort(allLoadedMovies);
  const favs = getFavoritesSet();

  const isListEmpty = moviesToShow.length === 0;
  emptyState.classList.toggle("hidden", !(isListEmpty && !isFetching && loader.classList.contains("hidden") && (currentQuery || favsOnlyActive())));

  const html = moviesToShow.map(m => {
    const isFav = favs.has(m.imdbID);
    const isExpanded = expandedImdbId === m.imdbID;
    const posterSrc = getPosterSrc(m.Poster);
    const rating = m.imdbRating && m.imdbRating !== "N/A" ? m.imdbRating : "–";
    
    const metaHtml = [
      m.Year ? `<span class="pill">${escapeHtml(m.Year)}</span>` : "",
      m.Type ? `<span class="pill" style="text-transform: capitalize;">${escapeHtml(m.Type)}</span>` : ""
    ].join("");

    return `
      <div class="movie-card" data-imdbid="${escapeHtml(m.imdbID)}">
        <div class="poster-wrap">
          ${m.imdbRating && m.imdbRating !== "N/A" ? `<div class="rating-badge">★ ${rating}</div>` : ""}
          ${posterSrc 
            ? `<img loading="lazy" class="poster" src="${escapeHtml(posterSrc)}" alt="${escapeHtml(m.Title)} poster" />` 
            : `<div class="poster"></div>`}
        </div>
        <div class="movie-body">
          <h3 class="movie-title">${escapeHtml(m.Title)}</h3>
          <div class="movie-meta">${metaHtml}</div>
          ${m.Genre && m.Genre !== "N/A" ? `<div class="movie-genres">${escapeHtml(m.Genre)}</div>` : ""}
          
          <div class="movie-actions">
            <button class="btn btn-secondary" type="button" data-action="toggle-details">
              ${isExpanded ? 'Hide Info' : 'Details'}
            </button>
            <button class="btn btn-fav ${isFav ? 'active' : ''}" type="button" data-action="toggle-fav">
              ${isFav ? '♥ Saved' : '♡ Save'}
            </button>
          </div>
          
          ${isExpanded ? `
            <div class="details">
              <div><strong>Rated:</strong> ${escapeHtml(m.Rated || "N/A")}</div>
              <div><strong>Runtime:</strong> ${escapeHtml(m.Runtime || "N/A")}</div>
              <div><strong>Director:</strong> ${escapeHtml(m.Director || "N/A")}</div>
              <div class="details-plot">${escapeHtml(m.Plot || "No plot available.")}</div>
            </div>
          ` : ""}
        </div>
      </div>
    `;
  }).join("");

  moviesContainer.innerHTML = html;
};

const favsOnlyActive = () => favoritesOnly.checked;

[typeFilter, genreFilter, ratingFilter, yearFilter, favoritesOnly, sortBy].forEach(el => {
  el.addEventListener("change", render);
});

moviesContainer.addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-action]");
  if (!btn) return;

  const card = btn.closest(".movie-card");
  const imdbID = card?.dataset?.imdbid;
  if (!imdbID) return;

  if (btn.dataset.action === "toggle-fav") {
    const favs = getFavoritesSet();
    favs.has(imdbID) ? favs.delete(imdbID) : favs.add(imdbID);
    setFavoritesSet(favs);
    render();
  }

  if (btn.dataset.action === "toggle-details") {
    expandedImdbId = expandedImdbId === imdbID ? null : imdbID;
    render();
  }
});

const initTheme = () => {
  const stored = localStorage.getItem("theme");
  const prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
  const theme = stored === "light" || stored === "dark" ? stored : (prefersDark ? "dark" : "dark");
  document.documentElement.dataset.theme = theme;
};

themeToggle.addEventListener("click", () => {
  const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  document.documentElement.dataset.theme = next;
  localStorage.setItem("theme", next);
});

// Boot init
initTheme();
render();
