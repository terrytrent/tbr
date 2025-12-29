# TBR Tracker

A lightweight browser-based tracker for managing your to-be-read (TBR) list. The app lets you collect books, enrich them with Open Library metadata, and keep notes as you move them through your reading pipeline.

## Features
- Add books with title, author, genre, priority, and personal notes.
- Automatically fetch cover art, author, and descriptions from Open Library and add a Goodreads search link for each entry.
- Track status across wishlist, queued, reading, and finished; view aggregate stats and filter/sort/search the list.
- Mark finished books with a star rating and written review, including inline editing of saved feedback.
- Responsive card layout that surfaces cover, description, status badges, and quick actions.

## Running the app
1. Open `index.html` in your browser (no build step required).
2. Add a book using the form; cover and description details will populate automatically when available.

## Tests
Automated tests run under the built-in Node test runner:

```bash
npm test
```

The suite uses lightweight DOM stubs to validate metadata submission, finishing flow, rating updates, and helper utilities.
