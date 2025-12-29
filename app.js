const form = document.getElementById("book-form");
const list = document.getElementById("book-list");
const emptyState = document.getElementById("empty-state");
const filterStatus = document.getElementById("filter-status");
const sortBy = document.getElementById("sort-by");
const searchInput = document.getElementById("search");
const resetFormBtn = document.getElementById("reset-form");
const submitButton = document.getElementById("submit-button");

const stats = {
  total: document.getElementById("stat-total"),
  active: document.getElementById("stat-active"),
  upcoming: document.getElementById("stat-upcoming"),
};

const storageKey = "tbr.books";
let books = loadBooks();
let editingId = null;

function loadBooks() {
  const stored = localStorage.getItem(storageKey);
  if (!stored) return [];
  try {
    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.warn("Could not parse saved books", err);
    return [];
  }
}

function saveBooks() {
  localStorage.setItem(storageKey, JSON.stringify(books));
}

function handleSubmit(event) {
  event.preventDefault();
  const formData = new FormData(form);
  const title = formData.get("title").trim();
  const author = formData.get("author").trim();
  const genre = formData.get("genre").trim();
  const status = formData.get("status");
  const priority = Number(formData.get("priority")) || 5;
  const notes = formData.get("notes").trim();

  if (!title) {
    form.querySelector("#title").focus();
    return;
  }

  const now = Date.now();
  if (editingId) {
    books = books.map((book) =>
      book.id === editingId
        ? { ...book, title, author, genre, status, priority, notes }
        : book
    );
  } else {
    const newBook = { id: crypto.randomUUID(), title, author, genre, status, priority, notes, createdAt: now };
    books = [newBook, ...books];
  }

  saveBooks();
  render();
  form.reset();
  form.querySelector("#priority").value = 5;
  editingId = null;
  submitButton.textContent = "Add to list";
}

function renderStats(filtered) {
  const total = books.length;
  const active = books.filter((book) => book.status === "reading").length;
  const upcoming = books.filter((book) => book.status === "queued" || book.status === "wishlist").length;

  stats.total.textContent = total;
  stats.active.textContent = active;
  stats.upcoming.textContent = upcoming;

  const visibleCount = filtered.length;
  list.setAttribute("aria-label", `${visibleCount} books shown`);
}

function render() {
  const query = searchInput.value.toLowerCase();
  const statusFilter = filterStatus.value;
  const sort = sortBy.value;

  const filtered = books
    .filter((book) => {
      const matchesQuery = [book.title, book.author].some((field) =>
        (field || "").toLowerCase().includes(query)
      );
      const matchesStatus = statusFilter === "all" || book.status === statusFilter;
      return matchesQuery && matchesStatus;
    })
    .sort((a, b) => {
      if (sort === "priority") return (b.priority || 0) - (a.priority || 0);
      if (sort === "title") return a.title.localeCompare(b.title);
      if (sort === "author") return (a.author || "").localeCompare(b.author || "");
      if (sort === "created") return (b.createdAt || 0) - (a.createdAt || 0);
      return 0;
    });

  list.innerHTML = "";
  if (!filtered.length) {
    emptyState.style.display = "block";
  } else {
    emptyState.style.display = "none";
  }

  filtered.forEach((book) => list.appendChild(renderCard(book)));
  renderStats(filtered);
}

function renderCard(book) {
  const card = document.createElement("article");
  card.className = "card";

  const content = document.createElement("div");
  const title = document.createElement("h3");
  title.textContent = book.title;
  content.appendChild(title);

  if (book.author) {
    const meta = document.createElement("p");
    meta.className = "meta";
    meta.textContent = book.author + (book.genre ? ` • ${book.genre}` : "");
    content.appendChild(meta);
  } else if (book.genre) {
    const meta = document.createElement("p");
    meta.className = "meta";
    meta.textContent = book.genre;
    content.appendChild(meta);
  }

  const badges = document.createElement("div");
  badges.className = "badges";

  const status = document.createElement("span");
  status.className = `badge status-${book.status}`;
  status.textContent = formatStatus(book.status);
  badges.appendChild(status);

  const priority = document.createElement("span");
  priority.className = "badge priority";
  priority.textContent = `Priority ${book.priority || 0}`;
  badges.appendChild(priority);

  if (book.notes) {
    const notes = document.createElement("p");
    notes.className = "notes";
    notes.textContent = book.notes;
    content.appendChild(notes);
  }

  content.appendChild(badges);

  const actions = document.createElement("div");
  actions.className = "actions";
  const editBtn = document.createElement("button");
  editBtn.className = "icon-btn";
  editBtn.textContent = "Edit";
  editBtn.addEventListener("click", () => startEdit(book));

  const deleteBtn = document.createElement("button");
  deleteBtn.className = "icon-btn";
  deleteBtn.textContent = "Remove";
  deleteBtn.addEventListener("click", () => removeBook(book.id));

  actions.append(editBtn, deleteBtn);

  card.append(content, actions);
  return card;
}

function formatStatus(status) {
  const labels = {
    wishlist: "Wishlist",
    queued: "Queued",
    reading: "Reading",
    finished: "Finished",
  };
  return labels[status] || status;
}

function startEdit(book) {
  editingId = book.id;
  form.title.value = book.title;
  form.author.value = book.author || "";
  form.genre.value = book.genre || "";
  form.status.value = book.status;
  form.priority.value = book.priority || 5;
  form.notes.value = book.notes || "";
  submitButton.textContent = "Update book";
  form.title.focus();
}

function removeBook(id) {
  books = books.filter((book) => book.id !== id);
  saveBooks();
  render();
}

form.addEventListener("submit", handleSubmit);
filterStatus.addEventListener("change", render);
sortBy.addEventListener("change", render);
searchInput.addEventListener("input", render);
resetFormBtn.addEventListener("click", () => {
  form.reset();
  form.querySelector("#priority").value = 5;
  editingId = null;
  submitButton.textContent = "Add to list";
});

render();
