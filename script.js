const API_KEY = 7015cea ;

const searchInput = document.getElementById("searchInput");
const moviesContainer = document.getElementById("moviesContainer");
const loader = document.getElementById("loader");
const emptyState = document.getElementById("emptyState");

// debounce function
function debounce(func, delay) {
  let timeout;
  return function (...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), delay);
  };
}

async function fetchMovies(query) {
  if (!query) {
    moviesContainer.innerHTML = "";
    return;
  }

  loader.classList.remove("hidden");
  emptyState.classList.add("hidden");

  try {
    const res = await fetch(`https://www.omdbapi.com/?apikey=${API_KEY}&s=${query}`);
    const data = await res.json();

    loader.classList.add("hidden");

    if (data.Response === "False") {
      moviesContainer.innerHTML = "";
      emptyState.classList.remove("hidden");
      return;
    }

    displayMovies(data.Search);
  } catch (error) {
    loader.classList.add("hidden");
    console.error(error);
  }
}

function displayMovies(movies) {
  moviesContainer.innerHTML = "";

  movies.forEach(movie => {
    const div = document.createElement("div");
    div.classList.add("movie-card");

    div.innerHTML = `
      <img src="${movie.Poster !== "N/A" ? movie.Poster : ''}" />
      <h3>${movie.Title}</h3>
      <p>${movie.Year}</p>
    `;

    moviesContainer.appendChild(div);
  });
}

// live search
searchInput.addEventListener(
  "input",
  debounce((e) => {
    fetchMovies(e.target.value);
  }, 500)
);
