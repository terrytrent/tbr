const test = require('node:test');
const assert = require('node:assert');
const crypto = require('node:crypto');

class FakeClassList {
  constructor(owner) {
    this.owner = owner;
    this.set = new Set();
  }
  add(value) {
    this.set.add(value);
    this.owner.className = Array.from(this.set).join(' ');
  }
  remove(value) {
    this.set.delete(value);
    this.owner.className = Array.from(this.set).join(' ');
  }
  toggle(value, force) {
    if (force === undefined) {
      this.set.has(value) ? this.set.delete(value) : this.set.add(value);
    } else if (force) {
      this.set.add(value);
    } else {
      this.set.delete(value);
    }
    this.owner.className = Array.from(this.set).join(' ');
  }
  contains(value) {
    return this.set.has(value);
  }
}

class FakeElement {
  constructor(tagName = 'div', id = '') {
    this.tagName = tagName.toUpperCase();
    this.id = id;
    this.children = [];
    this.style = {};
    this.dataset = {};
    this.className = '';
    this.classList = new FakeClassList(this);
    this.textContent = '';
    this.value = '';
    this.name = '';
    this.type = '';
    this.attributes = {};
    this.listeners = {};
  }
  appendChild(child) {
    this.children.push(child);
    return child;
  }
  append(...kids) {
    kids.forEach((child) => this.appendChild(child));
  }
  addEventListener(event, handler) {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event].push(handler);
  }
  dispatchEvent(event) {
    const handlers = this.listeners[event.type] || [];
    handlers.forEach((fn) => fn(event));
  }
  setAttribute(name, value) {
    this.attributes[name] = value;
    if (name === 'class') this.className = value;
    if (name === 'data-star') this.dataset.star = value;
  }
  focus() {}
  get innerHTML() {
    return this.children.map((child) => child.textContent).join('');
  }
  set innerHTML(value) {
    this.textContent = value;
    this.children = [];
  }
  querySelectorAll(selector) {
    if (selector === '[data-star]') {
      return this.children.filter((child) => child.dataset && child.dataset.star);
    }
    if (selector.startsWith('.')) {
      const className = selector.replace('.', '');
      const matches = [];
      const walk = (node) => {
        if ((node.className || '').split(' ').includes(className)) {
          matches.push(node);
        }
        node.children.forEach(walk);
      };
      walk(this);
      return matches;
    }
    return [];
  }
  querySelector(selector) {
    if (selector.startsWith('#')) {
      const id = selector.slice(1);
      return (
        this.children.find((child) => child.id === id) ||
        this.children.map((child) => child.querySelector(selector)).find(Boolean) ||
        null
      );
    }
    if (selector.startsWith('.')) {
      return this.querySelectorAll(selector)[0] || null;
    }
    return null;
  }
  reset() {
    this.children
      .filter((child) => child.name)
      .forEach((child) => {
        child.value = child.type === 'number' ? 0 : '';
      });
  }
}

class FakeFormElement extends FakeElement {
  constructor(id) {
    super('form', id);
    this.elements = [];
  }
  appendChild(child) {
    super.appendChild(child);
    if (child.name) this.elements.push(child);
    return child;
  }
  reset() {
    this.elements.forEach((el) => {
      if (el.type === 'number') {
        el.value = 0;
      } else if (el.tagName === 'SELECT') {
        el.value = el.options?.[0]?.value || '';
      } else {
        el.value = '';
      }
    });
  }
}

class FakeDocument {
  constructor() {
    this.elements = {};
    this.starButtons = [];
    this.body = new FakeElement('body');
  }
  register(element) {
    if (element.id) this.elements[element.id] = element;
    return element;
  }
  createElement(tag) {
    return new FakeElement(tag);
  }
  getElementById(id) {
    return this.elements[id];
  }
  querySelectorAll(selector) {
    if (selector === '[data-star]') {
      return this.starButtons;
    }
    return [];
  }
}

class FakeStorage {
  constructor() {
    this.map = new Map();
  }
  getItem(key) {
    const value = this.map.get(key);
    return value === undefined ? null : value;
  }
  setItem(key, value) {
    this.map.set(key, value);
  }
  removeItem(key) {
    this.map.delete(key);
  }
  clear() {
    this.map.clear();
  }
}

class FakeEvent {
  constructor(type) {
    this.type = type;
  }
  preventDefault() {}
}

class FakeFormData {
  constructor(form) {
    this.entries = new Map();
    form.elements.forEach((el) => {
      this.entries.set(el.name, el.value);
    });
  }
  get(key) {
    const value = this.entries.get(key);
    return value === undefined ? '' : value;
  }
}

function findByClass(element, className) {
  if ((element.className || '').split(' ').includes(className)) return element;
  for (const child of element.children) {
    const match = findByClass(child, className);
    if (match) return match;
  }
  return null;
}

function setupDom() {
  const document = new FakeDocument();
  const form = document.register(new FakeFormElement('book-form'));

  const title = document.register(new FakeElement('input', 'title'));
  title.name = 'title';
  form.appendChild(title);

  const author = document.register(new FakeElement('input', 'author'));
  author.name = 'author';
  form.appendChild(author);

  const genre = document.register(new FakeElement('input', 'genre'));
  genre.name = 'genre';
  form.appendChild(genre);

  const status = document.register(new FakeElement('select', 'status'));
  status.name = 'status';
  status.value = 'wishlist';
  form.appendChild(status);

  const priority = document.register(new FakeElement('input', 'priority'));
  priority.name = 'priority';
  priority.type = 'number';
  priority.value = 5;
  form.appendChild(priority);

  const notes = document.register(new FakeElement('textarea', 'notes'));
  notes.name = 'notes';
  form.appendChild(notes);

  const rating = document.register(new FakeElement('input', 'rating'));
  rating.name = 'rating';
  rating.value = 0;
  form.appendChild(rating);

  const review = document.register(new FakeElement('textarea', 'review'));
  review.name = 'review';
  form.appendChild(review);

  const list = document.register(new FakeElement('div', 'book-list'));
  const emptyState = document.register(new FakeElement('div', 'empty-state'));
  const filterStatus = document.register(new FakeElement('select', 'filter-status'));
  filterStatus.value = 'all';
  const sortBy = document.register(new FakeElement('select', 'sort-by'));
  sortBy.value = 'priority';
  const search = document.register(new FakeElement('input', 'search'));
  const resetForm = document.register(new FakeElement('button', 'reset-form'));
  const submitButton = document.register(new FakeElement('button', 'submit-button'));
  const ratingGroup = document.register(new FakeElement('div', 'rating-group'));
  const reviewGroup = document.register(new FakeElement('div', 'review-group'));
  const statTotal = document.register(new FakeElement('span', 'stat-total'));
  const statActive = document.register(new FakeElement('span', 'stat-active'));
  const statUpcoming = document.register(new FakeElement('span', 'stat-upcoming'));

  document.starButtons = Array.from({ length: 5 }, (_, idx) => {
    const btn = new FakeElement('button');
    btn.dataset.star = String(idx + 1);
    return btn;
  });

  const body = document.body;
  body.append(form);
  body.append(list);
  body.append(emptyState);
  body.append(filterStatus);
  body.append(sortBy);
  body.append(search);
  body.append(resetForm);
  body.append(submitButton);
  body.append(ratingGroup);
  body.append(reviewGroup);
  body.append(statTotal);
  body.append(statActive);
  body.append(statUpcoming);
  document.starButtons.forEach((btn) => body.appendChild(btn));

  return { document, body, form, list, emptyState };
}

function setupEnvironment() {
  const dom = setupDom();
  global.document = dom.document;
  global.window = { document: dom.document };
  global.localStorage = new FakeStorage();
  global.FormData = FakeFormData;
  global.Event = FakeEvent;
  global.crypto = crypto;
  return dom;
}

function loadApp() {
  setupEnvironment();
  return require('../app');
}

function resetModules() {
  delete require.cache[require.resolve('../app')];
}

test('buildGoodreadsUrl joins title and author', () => {
  resetModules();
  const app = loadApp();
  const url = app.buildGoodreadsUrl('Sample Book', 'Author Name');
  assert.ok(url.includes('Sample%20Book'));
  assert.ok(url.includes('Author%20Name'));
});

test('toggleFinishedFields shows and hides conditional fields', () => {
  resetModules();
  const app = loadApp();
  const status = document.getElementById('status');
  const ratingGroup = document.getElementById('rating-group');
  const reviewGroup = document.getElementById('review-group');

  status.value = 'finished';
  app.toggleFinishedFields();
  assert.equal(ratingGroup.style.display, 'block');
  assert.equal(reviewGroup.style.display, 'block');

  status.value = 'reading';
  app.toggleFinishedFields();
  assert.equal(ratingGroup.style.display, 'none');
  assert.equal(reviewGroup.style.display, 'none');
});

test('handleSubmit saves a new book with metadata and updates counts', async () => {
  resetModules();
  const app = loadApp();
  const status = document.getElementById('status');
  status.value = 'queued';
  const form = document.getElementById('book-form');

  document.getElementById('title').value = 'Metadata Book';
  document.getElementById('author').value = 'Manual Author';
  document.getElementById('genre').value = 'Fiction';
  document.getElementById('priority').value = 7;
  document.getElementById('notes').value = 'Interesting plot';

  let fetchCalls = 0;
  global.fetch = async () => {
    fetchCalls += 1;
    if (fetchCalls === 1) {
      return {
        ok: true,
        json: async () => ({
          docs: [
            {
              author_name: ['Fetched Author'],
              cover_i: 123,
              key: '/works/OL1',
              first_sentence: 'Opening line',
            },
          ],
        }),
      };
    }
    return {
      ok: true,
      json: async () => ({ description: 'Detailed description' }),
    };
  };

  await app.handleSubmit(new FakeEvent('submit'));
  const books = app.getBooks();
  assert.equal(books.length, 1);
  const saved = books[0];
  assert.equal(saved.author, 'Fetched Author');
  assert.equal(saved.genre, 'Fiction');
  assert.equal(saved.priority, 7);
  assert.equal(saved.status, 'queued');
  assert.equal(saved.description, 'Detailed description');
  assert.ok(saved.goodreadsUrl.includes('Metadata%20Book'));
});

test('markFinished promotes a book and opens review editor', () => {
  resetModules();
  const app = loadApp();
  const baseBook = { id: '1', title: 'Test', status: 'reading', priority: 5 };
  app.setBooks([baseBook]);

  app.markFinished(baseBook);
  const updated = app.getBooks()[0];
  assert.equal(updated.status, 'finished');

  const reviewForm = findByClass(document.getElementById('book-list').children[0], 'review-form');
  assert.ok(reviewForm);
});

test('updateRating stores the rating and refreshes list', () => {
  resetModules();
  const app = loadApp();
  const book = { id: 'abc', title: 'Rated', status: 'finished', priority: 3, rating: 0 };
  app.setBooks([book]);

  app.updateRating('abc', 4);
  const updated = app.getBooks()[0];
  assert.equal(updated.rating, 4);

  const card = document.getElementById('book-list').children[0];
  const label = findByClass(card, 'rating-label');
  assert.equal(label.textContent, '4/5');
});

test('render filters and sorts visible cards', () => {
  resetModules();
  const app = loadApp();
  const list = document.getElementById('book-list');
  const filter = document.getElementById('filter-status');
  const sort = document.getElementById('sort-by');
  const search = document.getElementById('search');

  app.setBooks([
    { id: 'a', title: 'Alpha', author: 'Zed', status: 'reading', priority: 3, createdAt: 2 },
    { id: 'b', title: 'Beta', author: 'Aaron', status: 'queued', priority: 9, createdAt: 3 },
    { id: 'c', title: 'Gamma', author: 'Zed', status: 'finished', priority: 5, createdAt: 1 },
  ]);

  filter.value = 'reading';
  app.render();
  assert.equal(list.children.length, 1);
  assert.equal(list.children[0].dataset.title, 'Alpha');

  filter.value = 'all';
  search.value = 'beta';
  app.render();
  assert.equal(list.children.length, 1);
  assert.equal(list.children[0].dataset.title, 'Beta');

  search.value = '';
  sort.value = 'priority';
  app.render();
  assert.deepEqual(
    Array.from(list.children).map((card) => card.dataset.title),
    ['Beta', 'Gamma', 'Alpha']
  );

  sort.value = 'created';
  app.render();
  assert.deepEqual(
    Array.from(list.children).map((card) => card.dataset.title),
    ['Beta', 'Alpha', 'Gamma']
  );
});

