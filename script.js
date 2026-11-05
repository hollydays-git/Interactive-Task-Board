// 1. Get DOM elements.
const form = document.getElementById('task-form');
const titleInput = document.getElementById('task-title');
const descriptionInput = document.getElementById('task-description');
const categoryInput = document.getElementById('task-category');
const priorityInput = document.getElementById('task-priority');

const searchInput = document.getElementById('search-input');
const categoryFilter = document.getElementById('category-filter');
const resultsMessage = document.getElementById('results-message');
const storageMessage = document.getElementById('storage-message');

// Map statuses to task lists.
const lists = {
    todo: document.getElementById('list-todo'),
    'in-progress': document.getElementById('list-in-progress'),
    completed: document.getElementById('list-completed')
};

// Display labels for stored statuses.
const statuses = {
    todo: 'To Do',
    'in-progress': 'In Progress',
    completed: 'Completed'
};

// Source data; filters never delete tasks.
let tasks = [];
// Protect saved data if loading fails.
let canSave = true;

// 2. Load saved tasks.
function loadTasks() {
    try {
        const saved = localStorage.getItem('tasks');

        // No saved data on the first visit.
        if (saved === null) {
            return;
        }

        const loadedTasks = JSON.parse(saved);

        if (!Array.isArray(loadedTasks)) {
            throw new Error('Invalid data');
        }

        // Check fields and reject duplicate IDs.
        const ids = new Set();

        for (const task of loadedTasks) {
            if (
                task === null ||
                typeof task !== 'object' ||
                typeof task.id !== 'string' ||
                task.id === '' ||
                ids.has(task.id) ||
                typeof task.title !== 'string' ||
                task.title.trim() === '' ||
                !['Development', 'Design', 'Marketing'].includes(task.category) ||
                !['Low', 'Medium', 'High'].includes(task.priority) ||
                !Object.hasOwn(statuses, task.status) ||
                (task.description !== undefined &&
                    typeof task.description !== 'string')
            ) {
                throw new Error('Invalid task');
            }

            ids.add(task.id);
        }

        // Apply data only after validation.
        tasks = loadedTasks;
    } catch {
        // Keep existing storage untouched on failure.
        canSave = false;
        showStorageError(
            'Could not load saved tasks. Changes will not be saved.'
        );
    }
}

// 3. Save all tasks after changes.
function saveTasks() {
    if (!canSave) {
        return;
    }

    try {
        // Store the array as a JSON string.
        localStorage.setItem('tasks', JSON.stringify(tasks));
        storageMessage.hidden = true;
    } catch {
        showStorageError(
            'Could not save changes. Keep this page open.'
        );
    }
}

// Show an accessible storage error.
function showStorageError(text) {
    storageMessage.textContent = text;
    storageMessage.hidden = false;
}

// 4. Validate and add a To Do task.
form.addEventListener('submit', function (event) {
    // Prevent page reload on submit.
    event.preventDefault();

    const title = titleInput.value.trim();

    // Reject whitespace-only titles.
    titleInput.setCustomValidity(
        title === '' ? 'Enter a task title.' : ''
    );

    if (!form.reportValidity()) {
        return;
    }

    const task = {
        // Use a unique ID, independent of the title.
        id: crypto.randomUUID(),
        title: title,
        description: descriptionInput.value.trim(),
        category: categoryInput.value,
        priority: priorityInput.value,
        status: 'todo'
    };

    tasks.push(task);

    saveTasks();
    renderTasks();
    form.reset();
    titleInput.focus();
});

// Clear the validation error while typing.
titleInput.addEventListener('input', function () {
    titleInput.setCustomValidity('');
});

// 5. Update status by task ID.
function changeStatus(id, status) {
    for (const task of tasks) {
        if (task.id === id) {
            task.status = status;
            break;
        }
    }

    saveTasks();
    renderTasks();

    // Restore keyboard focus after rendering.
    document.getElementById('status-' + id)?.focus();
}

// 6. Delete by ID; titles may repeat.
function deleteTask(id) {
    tasks = tasks.filter(function (task) {
        return task.id !== id;
    });

    saveTasks();
    renderTasks();
    titleInput.focus();
}

// 7. Build a card and its controls.
function createCard(task) {
    const card = document.createElement('article');
    card.className = 'task-card';
    // Set the CSS priority colours.
    card.dataset.priority = task.priority;

    const title = document.createElement('h3');
    // Display user input as text, not HTML.
    title.textContent = task.title;
    card.append(title);

    // Skip empty descriptions.
    if (task.description) {
        const description = document.createElement('p');
        description.className = 'task-description';
        description.textContent = task.description;
        card.append(description);
    }

    const meta = document.createElement('div');
    meta.className = 'task-meta';

    const category = document.createElement('span');
    category.textContent = task.category;

    const priority = document.createElement('span');
    priority.className = 'priority-badge';
    // Show priority with text as well as colour.
    priority.textContent = task.priority + ' Priority';

    meta.append(category, priority);

    const actions = document.createElement('div');
    actions.className = 'task-actions';

    const select = document.createElement('select');
    select.id = 'status-' + task.id;
    // Name the control for screen readers.
    select.setAttribute('aria-label', 'Status for ' + task.title);

    for (const status in statuses) {
        const option = document.createElement('option');
        option.value = status;
        option.textContent = statuses[status];
        select.append(option);
    }

    select.value = task.status;

    select.addEventListener('change', function () {
        changeStatus(task.id, select.value);
    });

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'btn btn-danger';
    button.textContent = 'Delete';
    button.setAttribute('aria-label', 'Delete ' + task.title);

    button.addEventListener('click', function () {
        deleteTask(task.id);
    });

    actions.append(select, button);
    card.append(meta, actions);

    return card;
}

// 8. Render tasks matching both filters.
function renderTasks() {
    // Ignore surrounding spaces and letter case.
    const query = searchInput.value.trim().toLowerCase();
    const category = categoryFilter.value;
    let visibleCount = 0;

    // Clear previous cards and messages.
    for (const status in lists) {
        lists[status].replaceChildren();
    }

    for (const task of tasks) {
        const matchesTitle = task.title.toLowerCase().includes(query);
        const matchesCategory =
            category === 'All' || task.category === category;

        // Match both filters without changing stored tasks.
        if (matchesTitle && matchesCategory) {
            const card = createCard(task);
            lists[task.status].append(card);
            visibleCount++;
        }
    }

    // Distinguish empty lists from filtered-out tasks.
    for (const status in lists) {
        if (lists[status].children.length === 0) {
            const message = document.createElement('p');
            message.className = 'empty-state';

            if (query !== '' || category !== 'All') {
                message.textContent = 'No matching tasks.';
            } else {
                message.textContent = 'No tasks yet.';
            }

            lists[status].append(message);
        }
    }

    resultsMessage.textContent =
        'Showing ' + visibleCount + ' of ' + tasks.length + ' tasks.';
}

// 9. Update results when filters change.
searchInput.addEventListener('input', renderTasks);
categoryFilter.addEventListener('change', renderTasks);

// 10. Load tasks, then render.
loadTasks();
renderTasks();