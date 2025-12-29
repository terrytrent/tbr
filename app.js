const form = document.getElementById("book-form");
const list = document.getElementById("book-list");
const emptyState = document.getElementById("empty-state");
const filterStatus = document.getElementById("filter-status");
const printButton = document.getElementById("print-list");
const searchInput = document.getElementById("search");
const resetFormBtn = document.getElementById("reset-form");
const submitButton = document.getElementById("submit-button");
const statusSelect = document.getElementById("status");
const ratingInput = document.getElementById("rating");
const reviewInput = document.getElementById("review");
const ratingGroup = document.getElementById("rating-group");
const reviewGroup = document.getElementById("review-group");
const starButtons = Array.from(document.querySelectorAll("[data-star]"));

const stats = {
  total: document.getElementById("stat-total"),
  active: document.getElementById("stat-active"),
  upcoming: document.getElementById("stat-upcoming"),
};

const storageKey = "tbr.books";
let books = loadBooks();
let editingId = null;
let reviewEdit = { id: null, text: "" };
const expandedCards = new Set();
let draggedId = null;

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

function setRatingUI(value) {
  starButtons.forEach((btn) => {
    const starValue = Number(btn.dataset.star);
    btn.classList.toggle("is-active", starValue <= value);
  });
}

function toggleFinishedFields() {
  const showExtras = statusSelect.value === "finished";
  ratingGroup.style.display = showExtras ? "block" : "none";
  reviewGroup.style.display = showExtras ? "block" : "none";
  if (!showExtras) {
    ratingInput.value = 0;
    reviewInput.value = "";
    setRatingUI(0);
  }
}

async function fetchBookMetadata(title, author) {
  const searchTerm = [title, author].filter(Boolean).join(" ");
  if (!searchTerm) return { goodreadsUrl: buildGoodreadsUrl(title, author) };

  try {
    const searchRes = await fetch(
      `https://openlibrary.org/search.json?limit=1&q=${encodeURIComponent(searchTerm)}`
    );
    if (!searchRes.ok) throw new Error("Search failed");
    const data = await searchRes.json();
    const doc = data.docs?.[0];
    if (!doc) return { goodreadsUrl: buildGoodreadsUrl(title, author) };

    const metadata = {
      author: doc.author_name?.[0] || author || "",
      coverUrl: doc.cover_i
        ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg`
        : "",
      goodreadsUrl: buildGoodreadsUrl(title, doc.author_name?.[0] || author),
      description: "",
    };

    if (doc.first_sentence) {
      metadata.description = Array.isArray(doc.first_sentence)
        ? doc.first_sentence[0]
        : doc.first_sentence;
    }

    if (doc.key) {
      try {
        const detailRes = await fetch(`https://openlibrary.org${doc.key}.json`);
        if (detailRes.ok) {
          const detail = await detailRes.json();
          if (detail.description) {
            metadata.description =
              typeof detail.description === "string"
                ? detail.description
                : detail.description.value || metadata.description;
          }
        }
      } catch (err) {
        console.warn("Could not load book details", err);
      }
    }

    return metadata;
  } catch (err) {
    console.warn("Metadata fetch failed", err);
    return { goodreadsUrl: buildGoodreadsUrl(title, author) };
  }
}

function buildGoodreadsUrl(title, author) {
  const query = [title, author].filter(Boolean).join(" ");
  return query ? `https://www.goodreads.com/search?q=${encodeURIComponent(query)}` : "";
}

async function handleSubmit(event) {
  event.preventDefault();
  const formData = new FormData(form);
  const title = formData.get("title").trim();
  const author = formData.get("author").trim();
  const genre = formData.get("genre").trim();
  const status = formData.get("status");
  const notes = formData.get("notes").trim();
  const rating = status === "finished" ? Number(formData.get("rating")) || 0 : 0;
  const review = status === "finished" ? formData.get("review").trim() : "";

  if (!title) {
    form.querySelector("#title").focus();
    return;
  }

  submitButton.disabled = true;
  submitButton.textContent = editingId ? "Updating..." : "Adding...";

  try {
    const metadata = await fetchBookMetadata(title, author);
    const now = Date.now();
    const baseBook = {
      title,
      author: metadata.author || author,
      genre,
      status,
      notes,
      rating,
      review,
      goodreadsUrl: metadata.goodreadsUrl,
      coverUrl: metadata.coverUrl,
      description: metadata.description,
    };

    if (editingId) {
      books = books.map((book) => {
        if (book.id !== editingId) return book;
        const merged = { ...book, ...baseBook };
        return merged;
      });
    } else {
      const newBook = { id: crypto.randomUUID(), ...baseBook, createdAt: now };
      books = [...books, newBook];
    }

    saveBooks();
    reviewEdit = { id: null, text: "" };
    render();
    form.reset();
    ratingInput.value = 0;
    setRatingUI(0);
    editingId = null;
  } finally {
    submitButton.textContent = "Add to list";
    submitButton.disabled = false;
    toggleFinishedFields();
  }
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

  const filtered = books.filter((book) => {
    const matchesQuery = [book.title, book.author].some((field) =>
      (field || "").toLowerCase().includes(query)
    );
    const matchesStatus = statusFilter === "all" || book.status === statusFilter;
    return matchesQuery && matchesStatus;
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

function toggleCard(id) {
  if (expandedCards.has(id)) {
    expandedCards.delete(id);
  } else {
    expandedCards.add(id);
  }
  render();
}

function attachDragEvents(card, id) {
  card.addEventListener("dragstart", (event) => {
    draggedId = id;
    card.classList.add("is-dragging");
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", id);
    }
  });

  card.addEventListener("dragend", () => {
    draggedId = null;
    card.classList.remove("is-dragging");
    Array.from(list.children).forEach((child) => child.classList.remove("drag-over"));
  });

  card.addEventListener("dragover", (event) => {
    event.preventDefault();
    if (draggedId && draggedId !== id) {
      card.classList.add("drag-over");
    }
  });

  card.addEventListener("dragleave", () => {
    card.classList.remove("drag-over");
  });

  card.addEventListener("drop", (event) => {
    event.preventDefault();
    event.stopPropagation();
    card.classList.remove("drag-over");
    if (draggedId && draggedId !== id) {
      moveBook(draggedId, id);
    }
    draggedId = null;
  });
}

function moveBook(dragged, target) {
  const draggedIndex = books.findIndex((book) => book.id === dragged);
  const targetIndex = books.findIndex((book) => book.id === target);
  if (draggedIndex === -1 || targetIndex === -1) return;
  const [entry] = books.splice(draggedIndex, 1);
  books.splice(targetIndex, 0, entry);
  saveBooks();
  render();
}

function moveBookToEnd(id) {
  const index = books.findIndex((book) => book.id === id);
  if (index === -1) return;
  const [entry] = books.splice(index, 1);
  books.push(entry);
  saveBooks();
  render();
}

function renderCard(book) {
  const card = document.createElement("article");
  card.className = "card";
  card.dataset.title = book.title;
  card.dataset.status = book.status;
  card.draggable = true;
  const isExpanded = expandedCards.has(book.id);
  card.classList.toggle("is-collapsed", !isExpanded);

  attachDragEvents(card, book.id);

  const header = document.createElement("div");
  header.className = "card-header";

  const dragHandle = document.createElement("span");
  dragHandle.className = "drag-handle";
  dragHandle.textContent = "⋮⋮";
  header.appendChild(dragHandle);

  const summary = document.createElement("div");
  summary.className = "card-summary";
  const title = document.createElement("h3");
  if (book.goodreadsUrl) {
    const link = document.createElement("a");
    link.href = book.goodreadsUrl;
    link.target = "_blank";
    link.rel = "noreferrer";
    link.textContent = book.title;
    title.appendChild(link);
  } else {
    title.textContent = book.title;
  }
  const authorLine = document.createElement("p");
  authorLine.className = "meta";
  authorLine.textContent = book.author || "Unknown author";
  summary.append(title, authorLine);

  const toggleBtn = document.createElement("button");
  toggleBtn.type = "button";
  toggleBtn.className = "collapse-toggle";
  toggleBtn.textContent = isExpanded ? "Hide details" : "Show details";
  toggleBtn.addEventListener("click", () => toggleCard(book.id));

  header.append(summary, toggleBtn);

  const details = document.createElement("div");
  details.className = "card-details";

  const layoutContainer = document.createElement("div");
  layoutContainer.className = "card-layout";

  const media = document.createElement("div");
  media.className = "card-media";
  if (book.coverUrl) {
    const img = document.createElement("img");
    img.src = book.coverUrl;
    img.alt = `${book.title} cover`;
    media.appendChild(img);
  } else {
    const placeholder = document.createElement("div");
    placeholder.className = "cover-placeholder";
    placeholder.textContent = book.title.charAt(0).toUpperCase();
    media.appendChild(placeholder);
  }

  const content = document.createElement("div");
  content.className = "card-body";

  const meta = document.createElement("p");
  meta.className = "meta";
  const authorText = book.author ? book.author : "Unknown author";
  meta.textContent = authorText + (book.genre ? ` • ${book.genre}` : "");
  content.appendChild(meta);

  if (book.description) {
    const description = document.createElement("p");
    description.className = "description";
    description.textContent = book.description;
    content.appendChild(description);
  }

  const badges = document.createElement("div");
  badges.className = "badges";

  const status = document.createElement("span");
  status.className = `badge status-${book.status}`;
  status.textContent = formatStatus(book.status);
  badges.appendChild(status);

  if (book.notes) {
    const notes = document.createElement("p");
    notes.className = "notes";
    notes.textContent = book.notes;
    content.appendChild(notes);
  }

  if (book.status === "finished") {
    const ratingRow = document.createElement("div");
    ratingRow.className = "rating-row";
    ratingRow.appendChild(renderStarDisplay(book, true));

    const reviewBlock = document.createElement("div");
    reviewBlock.className = "review-block";

    const reviewLabel = document.createElement("p");
    reviewLabel.className = "review-label";
    reviewLabel.textContent = "Review";

    const isEditingReview = reviewEdit.id === book.id;

    if (isEditingReview) {
      const formEl = document.createElement("form");
      formEl.className = "review-form";

      const textarea = document.createElement("textarea");
      textarea.value = reviewEdit.text;
      textarea.placeholder = "What did you think?";
      textarea.rows = 3;
      textarea.addEventListener("input", (e) => {
        reviewEdit = { ...reviewEdit, text: e.target.value };
      });

      const reviewActions = document.createElement("div");
      reviewActions.className = "review-actions";

      const saveBtn = document.createElement("button");
      saveBtn.type = "submit";
      saveBtn.className = "primary";
      saveBtn.textContent = "Save review";

      const cancelBtn = document.createElement("button");
      cancelBtn.type = "button";
      cancelBtn.className = "ghost";
      cancelBtn.textContent = "Cancel";
      cancelBtn.addEventListener("click", () => closeReviewEditor());

      reviewActions.append(saveBtn, cancelBtn);
      formEl.append(textarea, reviewActions);

      formEl.addEventListener("submit", (e) => {
        e.preventDefault();
        submitReview(book.id);
      });

      reviewBlock.append(reviewLabel, formEl);
    } else {
      const review = document.createElement("p");
      review.className = "review";
      review.textContent = book.review
        ? `“${book.review}”`
        : "Add a short review to remember what you thought.";

      reviewBlock.append(reviewLabel, review);
    }

    ratingRow.appendChild(reviewBlock);
    content.appendChild(ratingRow);
  }

  content.appendChild(badges);

  layoutContainer.append(media, content);
  details.appendChild(layoutContainer);

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

  if (book.status !== "finished") {
    const finishBtn = document.createElement("button");
    finishBtn.className = "icon-btn";
    finishBtn.textContent = "Mark finished";
    finishBtn.addEventListener("click", () => {
      expandedCards.add(book.id);
      markFinished(book);
    });
    actions.append(finishBtn);
  } else {
    const reviewBtn = document.createElement("button");
    reviewBtn.className = "icon-btn";
    reviewBtn.textContent = reviewEdit.id === book.id ? "Close review" : book.review ? "Edit review" : "Add review";
    reviewBtn.addEventListener("click", () => toggleReviewEditor(book));
    actions.append(reviewBtn);
  }

  actions.append(editBtn, deleteBtn);
  details.appendChild(actions);

  card.append(header, details);
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
  reviewEdit = { id: null, text: "" };
  form.title.value = book.title;
  form.author.value = book.author || "";
  form.genre.value = book.genre || "";
  form.status.value = book.status;
  form.notes.value = book.notes || "";
  ratingInput.value = book.status === "finished" ? book.rating || 0 : 0;
  reviewInput.value = book.status === "finished" ? book.review || "" : "";
  setRatingUI(Number(ratingInput.value));
  toggleFinishedFields();
  submitButton.textContent = "Update book";
  form.title.focus();
  expandedCards.add(book.id);
}

function markFinished(book) {
  books = books.map((entry) =>
    entry.id === book.id
      ? { ...entry, status: "finished", rating: entry.rating || 0, review: entry.review || "" }
      : entry
  );
  saveBooks();
  const updated = books.find((entry) => entry.id === book.id);
  reviewEdit = { id: book.id, text: updated?.review || "" };
  render();
}

function updateRating(id, rating) {
  books = books.map((book) =>
    book.id === id ? { ...book, status: "finished", rating } : book
  );
  saveBooks();
  render();
}

function toggleReviewEditor(book) {
  if (reviewEdit.id === book.id) {
    closeReviewEditor();
    return;
  }
  reviewEdit = { id: book.id, text: book.review || "" };
  render();
}

function closeReviewEditor() {
  reviewEdit = { id: null, text: "" };
  render();
}

function submitReview(id) {
  books = books.map((book) =>
    book.id === id
      ? { ...book, status: "finished", review: reviewEdit.text.trim() }
      : book
  );
  saveBooks();
  closeReviewEditor();
}

function renderStarDisplay(book, interactive = false) {
  const wrapper = document.createElement("div");
  wrapper.className = "star-display";
  const rating = Number(book.rating) || 0;

  for (let i = 1; i <= 5; i++) {
    const star = document.createElement(interactive ? "button" : "span");
    star.className = "star" + (i <= rating ? " is-active" : "");
    star.textContent = "★";
    if (interactive) {
      star.type = "button";
      star.setAttribute("aria-label", `${i} star${i > 1 ? "s" : ""}`);
      star.addEventListener("click", () => updateRating(book.id, i));
    }
    wrapper.appendChild(star);
  }

  const label = document.createElement("span");
  label.className = "rating-label";
  label.textContent = rating ? `${rating}/5` : "Tap a star";
  wrapper.appendChild(label);
  return wrapper;
}

function removeBook(id) {
  books = books.filter((book) => book.id !== id);
  saveBooks();
  if (reviewEdit.id === id) {
    reviewEdit = { id: null, text: "" };
  }
  expandedCards.delete(id);
  render();
}

form.addEventListener("submit", handleSubmit);
filterStatus.addEventListener("change", render);
searchInput.addEventListener("input", render);
resetFormBtn.addEventListener("click", () => {
  form.reset();
  editingId = null;
  submitButton.textContent = "Add to list";
  ratingInput.value = 0;
  setRatingUI(0);
  toggleFinishedFields();
});
statusSelect.addEventListener("change", toggleFinishedFields);
starButtons.forEach((btn) =>
  btn.addEventListener("click", () => {
    const value = Number(btn.dataset.star);
    ratingInput.value = value;
    setRatingUI(value);
  })
);

if (printButton) {
  printButton.addEventListener("click", () => window.print());
}

list.addEventListener("dragover", (event) => {
  event.preventDefault();
});

list.addEventListener("drop", (event) => {
  event.preventDefault();
  if (draggedId) {
    moveBookToEnd(draggedId);
  }
  draggedId = null;
});

render();
toggleFinishedFields();

if (typeof module !== "undefined") {
  module.exports = {
    buildGoodreadsUrl,
    closeReviewEditor,
    fetchBookMetadata,
    formatStatus,
    getBooks: () => books,
    handleSubmit,
    markFinished,
    moveBook,
    moveBookToEnd,
    removeBook,
    render,
    renderCard,
    renderStarDisplay,
    resetAppState: () => {
      books = [];
      editingId = null;
      reviewEdit = { id: null, text: "" };
      expandedCards.clear();
      localStorage.removeItem(storageKey);
      render();
      toggleFinishedFields();
    },
    saveBooks,
    setBooks: (nextBooks) => {
      books = nextBooks;
      expandedCards.clear();
      saveBooks();
      render();
    },
    setRatingUI,
    toggleCard,
    toggleFinishedFields,
    toggleReviewEditor,
    updateRating,
  };
}
