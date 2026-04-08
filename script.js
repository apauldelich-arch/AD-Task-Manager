/**
 * Premium Task Manager - Vanilla JS Core
 * Features: Dashboard, Day Views, Goal/Project CRUD, Task Expansion, LocalStorage persistence.
 */

class Store {
  constructor() {
    this.STORAGE_KEY = 'workspace_tasks_db_v3';
    this.data = this.load() || this.getDefaultData();
    this.saveStatus = ''; // 'saving', 'saved', 'error'
    this.currentCalendarDate = new Date();
  }

  getDefaultData() {
    return {
      activeView: 'dashboard', // dashboard, overdue, today, tomorrow, yesterday, <projectId>
      goals: [
        { id: 'g1', title: 'Life Optimization', projects: [], collapsed: false }
      ],
      projects: [
        { id: 'p1', goalId: 'g1', title: 'Example Project', notes: '', collapsed: false }
      ],
      tasks: [
        { id: 't1', projectId: 'p1', title: 'Explore the new UI', status: 'planned', due: '', notes: '', expanded: false }
      ],
      theme: 'light'
    };
  }

  load() {
    const json = localStorage.getItem(this.STORAGE_KEY);
    return json ? JSON.parse(json) : null;
  }

  async save() {
    this.onStatusChange('saving');
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.data));
      setTimeout(() => this.onStatusChange('saved'), 300);
      setTimeout(() => this.onStatusChange(''), 3000);
    } catch (e) {
      this.onStatusChange('error');
    }
  }

  onStatusChange(status) {
    this.saveStatus = status;
    window.dispatchEvent(new CustomEvent('save-status-changed', { detail: status }));
  }

  // --- Helpers ---
  generateId(prefix = '') { return `${prefix}${Date.now()}-${Math.random().toString(36).substr(2, 5)}`; }
  
  getGoalProgress(goalId) {
    const projs = this.data.projects.filter(p => p.goalId === goalId);
    if (!projs.length) return 0;
    const taskIds = projs.map(p => p.id);
    const tasks = this.data.tasks.filter(t => taskIds.includes(t.projectId));
    if (!tasks.length) return 0;
    return Math.round((tasks.filter(t => t.status === 'completed').length / tasks.length) * 100);
  }

  getProjectProgress(projectId) {
    const tasks = this.data.tasks.filter(t => t.projectId === projectId);
    if (!tasks.length) return 0;
    return Math.round((tasks.filter(t => t.status === 'completed').length / tasks.length) * 100);
  }

  isTaskOverdue(task) {
    if (!task.due || task.status === 'completed') return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return new Date(task.due) < today;
  }
}

class UI {
  constructor(store) {
    this.store = store;
    this.mainView = document.getElementById('main-view');
    this.innerView = document.getElementById('main-view'); // Re-using same logic but pointing to inner
    this.goalsContainer = document.getElementById('goals-container');
    this.calendarContainer = document.getElementById('sidebar-calendar');
    this.saveIndicator = document.getElementById('save-status');
    this.themeToggle = document.getElementById('theme-toggle');
    
    // Header elements
    this.searchBar = document.getElementById('global-search');
    this.quickAddInput = document.getElementById('quick-add-input');
    this.quickAddBtn = document.getElementById('quick-add-btn');
    this.suggestionsDropdown = document.getElementById('project-suggestions');

    this.init();
  }

  init() {
    this.applyTheme();
    this.bindGlobalEvents();
    this.render();
  }

  bindGlobalEvents() {
    // Save status listener
    window.addEventListener('save-status-changed', (e) => {
      this.saveIndicator.className = `save-indicator ${e.detail}`;
      this.saveIndicator.textContent = e.detail === 'saving' ? 'Saving...' : (e.detail === 'saved' ? '✓ Saved' : (e.detail === 'error' ? '⚠ Error' : ''));
    });

    // Sidebar View Switching
    document.querySelectorAll('.nav-item').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const view = e.currentTarget.dataset.view;
        this.store.data.activeView = view;
        this.store.save();
        this.render();
      });
    });

    // Add Goal
    document.getElementById('add-goal-btn').addEventListener('click', () => {
      const gId = this.store.generateId('g');
      this.store.data.goals.push({ id: gId, title: 'New Goal', projects: [], collapsed: false });
      this.store.save();
      this.render();
    });

    // Theme Toggle
    this.themeToggle.addEventListener('click', () => {
      this.store.data.theme = this.store.data.theme === 'dark' ? 'light' : 'dark';
      this.store.save();
      this.applyTheme();
    });

    // Global Group Toggle (Event Delegation)
    this.mainView.addEventListener('click', (e) => {
      const header = e.target.closest('.group-header');
      if (header) {
        const group = header.closest('.task-group');
        const contextId = group.dataset.context;
        if (contextId) {
          const proj = this.store.data.projects.find(p => p.id === contextId);
          if (proj) {
            proj.completedCollapsed = !proj.completedCollapsed;
            this.store.save();
            this.render();
          }
        }
      }
    });

    // --- Global Search ---
    this.searchBar.addEventListener('input', (e) => {
      const q = e.target.value.trim();
      if (q.length > 1) {
        this.renderSearch(q);
      } else if (q.length === 0) {
        this.render();
      }
    });

    // Keyboard Shortcut (CMD+K or CTRL+K)
    window.addEventListener('keydown', (e) => {
        if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
            e.preventDefault();
            this.searchBar.focus();
        }
    });

    // --- Quick Add ---
    const handleQuickAction = () => {
        const val = this.quickAddInput.value.trim();
        if (!val) return;
        this.handleQuickAdd(val);
        this.quickAddInput.value = '';
    };

    this.quickAddBtn.addEventListener('click', handleQuickAction);
    this.quickAddInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleQuickAction();
    });

    this.quickAddInput.addEventListener('input', (e) => {
        const val = e.target.value;
        const index = val.lastIndexOf('@');
        if (index !== -1) {
            const query = val.substring(index + 1).toLowerCase();
            this.updateProjectSuggestions(query);
        } else {
            this.suggestionsDropdown.style.display = 'none';
        }
    });

    // Close on click outside
    document.addEventListener('click', (e) => {
        if (!this.quickAddInput.contains(e.target) && !this.suggestionsDropdown.contains(e.target)) {
            this.suggestionsDropdown.style.display = 'none';
        }
    });
  }

  updateProjectSuggestions(query) {
    const projects = this.store.data.projects.filter(p => 
        !p.archived && p.title.toLowerCase().includes(query)
    );

    if (projects.length === 0) {
        this.suggestionsDropdown.style.display = 'none';
        return;
    }

    this.suggestionsDropdown.innerHTML = projects.map(p => {
        const goal = this.store.data.goals.find(g => g.id === p.goalId);
        return `
            <div class="suggestion-item" data-id="${p.id}" data-title="${p.title}">
                <i class="ph ph-briefcase"></i>
                <span>${p.title}</span>
                ${goal ? `<span class="suggestion-item-goal">${goal.title}</span>` : ''}
            </div>
        `;
    }).join('');

    this.suggestionsDropdown.style.display = 'block';

    this.suggestionsDropdown.querySelectorAll('.suggestion-item').forEach(item => {
        item.addEventListener('click', () => {
            const pTitle = item.dataset.title;
            const val = this.quickAddInput.value;
            const index = val.lastIndexOf('@');
            this.quickAddInput.value = val.substring(0, index) + '@' + pTitle + ' ';
            this.suggestionsDropdown.style.display = 'none';
            this.quickAddInput.focus();
        });
    });
  }

  handleQuickAdd(text) {
    // Basic parser for "@ProjectName"
    let title = text;
    let projectId = 'p1'; // Default
    
    if (text.includes('@')) {
        const parts = text.split('@');
        title = parts[0].trim();
        const pName = parts[1].trim().toLowerCase();
        const found = this.store.data.projects.find(p => p.title.toLowerCase().includes(pName));
        if (found) projectId = found.id;
    }

    this.store.data.tasks.push({
        id: this.store.generateId('t'),
        projectId,
        title,
        status: 'planned',
        due: '',
        notes: '',
        estimatedTime: 0,
        spentTime: 0,
        expanded: false
    });

    this.store.save();
    this.render();
  }

  renderSearch(query) {
    const q = query.toLowerCase();
    const tasks = this.store.data.tasks.filter(t => 
      t.title.toLowerCase().includes(q) || 
      (t.notes && t.notes.toLowerCase().includes(q))
    );

    this.mainView.innerHTML = `
      <div class="animate-fade">
        <header class="content-header">
           <h3 class="section-title">SEARCH RESULTS</h3>
           <h1 class="project-title-large"><i class="ph ph-magnifying-glass"></i> "${query}"</h1>
           <div class="text-xs text-secondary">${tasks.length} matches found across all projects</div>
        </header>

        <div class="tasks-container">
          ${this.renderGroupedTaskList(tasks)}
        </div>
      </div>
    `;

    this.bindTaskEvents(tasks);
  }

  applyTheme() {
    const theme = this.store.data.theme || 'light';
    document.body.setAttribute('data-theme', theme);
    const icon = this.themeToggle.querySelector('i');
    icon.className = theme === 'dark' ? 'ph ph-sun' : 'ph ph-moon';
  }

  render() {
    this.renderSidebar();
    this.renderCalendar();
    
    // Determine which main view to render
    const view = this.store.data.activeView;
    if (view === 'dashboard') this.renderDashboard();
    else if (['overdue', 'today', 'tomorrow', 'yesterday', 'thisweek'].includes(view)) this.renderDayView(view);
    else if (view === 'goals_list' || view === 'projects_list') this.renderGoalsListView();
    else if (view === 'archive_list') this.renderArchiveView();
    else if (view.startsWith('date:')) this.renderDateView(view.replace('date:', ''));
    else this.renderProjectView(view);
  }

  renderSidebar() {
    // Only highlight active dashboard links
    document.querySelectorAll('.nav-item').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.view === this.store.data.activeView);
    });

    // If goalsContainer exists in the sidebar, we keep it empty or remove it.
    if (this.goalsContainer) this.goalsContainer.innerHTML = '';
  }

  renderCalendar() {
    if (!this.calendarContainer) return;
    
    const now = new Date();
    const current = this.store.currentCalendarDate;
    const month = current.getMonth();
    const year = current.getFullYear();

    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    
    // Day of week adjustment (Monday start = 1, Sunday = 0)
    // We'll use 0=Sun for grid layout
    const monthName = new Intl.DateTimeFormat('en-US', { month: 'long' }).format(current);
    
    this.calendarContainer.innerHTML = `
      <div class="calendar-header">
        <span class="calendar-title">${monthName} ${year}</span>
        <div class="calendar-controls">
          <button class="calendar-btn prev-month"><i class="ph ph-caret-left"></i></button>
          <button class="calendar-btn next-month"><i class="ph ph-caret-right"></i></button>
        </div>
      </div>
      <div class="calendar-grid">
        <div class="calendar-weekday">M</div>
        <div class="calendar-weekday">T</div>
        <div class="calendar-weekday">W</div>
        <div class="calendar-weekday">T</div>
        <div class="calendar-weekday">F</div>
        <div class="calendar-weekday">S</div>
        <div class="calendar-weekday">S</div>
        ${this.renderCalendarDays(year, month, daysInMonth)}
      </div>
    `;

    // Events
    this.calendarContainer.querySelector('.prev-month').addEventListener('click', () => {
      this.store.currentCalendarDate.setMonth(this.store.currentCalendarDate.getMonth() - 1);
      this.render();
    });
    this.calendarContainer.querySelector('.next-month').addEventListener('click', () => {
      this.store.currentCalendarDate.setMonth(this.store.currentCalendarDate.getMonth() + 1);
      this.render();
    });
    
    this.calendarContainer.querySelectorAll('.calendar-day').forEach(dayEl => {
      dayEl.addEventListener('click', () => {
        const dateStr = dayEl.dataset.date;
        this.store.data.activeView = `date:${dateStr}`;
        this.store.save();
        this.render();
      });
    });
  }

  renderCalendarDays(year, month, daysInMonth) {
    let daysHtml = '';
    
    // Day of week adjustment (Monday start = 0, Sunday = 6)
    const firstDayRaw = new Date(year, month, 1).getDay();
    const firstDay = firstDayRaw === 0 ? 6 : firstDayRaw - 1;
    
    // Empty cells before first day
    for (let i = 0; i < firstDay; i++) {
        daysHtml += `<div class="calendar-day not-current"></div>`;
    }
    
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const todayDate = new Date();
      const formatDate = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const todayStr = formatDate(todayDate);
      
      const tomorrow = new Date(todayDate); tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowStr = formatDate(tomorrow);
      
      const yesterday = new Date(todayDate); yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = formatDate(yesterday);

      const isToday = todayStr === dateStr;
      
      let isActive = this.store.data.activeView === `date:${dateStr}`;
      if (this.store.data.activeView === 'today' && dateStr === todayStr) isActive = true;
      if (this.store.data.activeView === 'tomorrow' && dateStr === tomorrowStr) isActive = true;
      if (this.store.data.activeView === 'yesterday' && dateStr === yesterdayStr) isActive = true;
      
      const hasTasks = this.store.data.tasks.some(t => t.due === dateStr);
      
      daysHtml += `
        <div class="calendar-day ${isToday ? 'today' : ''} ${isActive ? 'active' : ''}" data-date="${dateStr}">
          ${day}
          ${hasTasks ? '<div class="task-dot"></div>' : ''}
        </div>
      `;
    }
    
    return daysHtml;
  }

  // --- Main Views ---

  renderDashboard() {
    const totalTasks = this.store.data.tasks;
    const completed = totalTasks.filter(t => t.status === 'completed').length;
    const inProgress = totalTasks.filter(t => t.status === 'in-progress').length;
    const planned = totalTasks.filter(t => t.status === 'planned').length;

    this.mainView.innerHTML = `
      <div class="animate-fade">
        <header class="content-header">
           <h1 class="project-title-large">Dashboard</h1>
        </header>

        <div class="metrics-grid mb-8">
          <div class="metric-card">
            <div class="metric-val text-blue">${this.store.data.goals.length}</div>
            <div class="metric-label">Goals</div>
          </div>
          <div class="metric-card">
            <div class="metric-val text-amber">${this.store.data.projects.length}</div>
            <div class="metric-label">Projects</div>
          </div>
          <div class="metric-card">
            <div class="metric-val">${totalTasks.length}</div>
            <div class="metric-label">Total Tasks</div>
          </div>
          <div class="metric-card">
            <div class="metric-val text-blue">${planned}</div>
            <div class="metric-label">Planned</div>
          </div>
          <div class="metric-card">
            <div class="metric-val text-amber">${inProgress}</div>
            <div class="metric-label">Doing</div>
          </div>
          <div class="metric-card">
            <div class="metric-val text-green">${completed}</div>
            <div class="metric-label">Done</div>
          </div>
        </div>

        <section class="focus-section">
            <h2 class="project-title-large mb-4">Managerial Focus</h2>
            <div class="focus-grid">
                ${this.renderFocusCards()}
            </div>
        </section>

        <div class="mt-10 mb-4">
            <h2 class="project-title-large">Goals & Projects</h2>
        </div>

        <div class="dashboard-grid">
          ${this.store.data.goals.map((goal, index) => {
            const goalColors = [
              'rgba(59, 130, 246, 0.06)', // L-Blue
              'rgba(139, 92, 246, 0.06)', // L-Purple
              'rgba(16, 185, 129, 0.06)', // L-Green
              'rgba(245, 158, 11, 0.06)', // L-Amber
              'rgba(239, 68, 68, 0.06)',  // L-Red
              'rgba(107, 114, 128, 0.06)' // L-Gray
            ];
            const color = goalColors[index % goalColors.length];
            const progress = this.store.getGoalProgress(goal.id);
            const projs = this.store.data.projects.filter(p => p.goalId === goal.id && !p.archived);

            return `
              <div class="dashboard-goal-card" style="background-color: ${color}; border-color: ${color.replace('0.06', '0.12')}">
                <div class="goal-card-header">
                  <span class="goal-card-title" contenteditable="true" data-id="${goal.id}">${goal.title}</span>
                  <span class="progress-text">${progress}%</span>
                </div>
                <div class="progress-bar-track">
                  <div class="progress-bar-fill" style="width: ${progress}%"></div>
                </div>
                <div class="mt-4">
                  ${projs.map(p => `
                    <a href="#" class="dashboard-project-row" data-id="${p.id}">
                      <div class="project-row-top">
                        <span>${p.title}</span>
                        <span class="project-row-tasks">${this.store.data.tasks.filter(t => t.projectId === p.id).length} tasks</span>
                      </div>
                      <div class="progress-bar-track" style="height: 3px;">
                        <div class="progress-bar-fill" style="width: ${this.store.getProjectProgress(p.id)}%"></div>
                      </div>
                    </a>
                  `).join('')}
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;

    this.mainView.querySelectorAll('.dashboard-project-row').forEach(row => {
      row.addEventListener('click', (e) => {
        e.preventDefault();
        this.store.data.activeView = row.dataset.id;
        this.store.save();
        this.render();
      });
    });

    // Edit Goal Title from Dashboard
    this.mainView.querySelectorAll('.goal-card-title').forEach(span => {
      span.addEventListener('blur', () => {
        const id = span.dataset.id;
        const newTitle = span.innerText.trim();
        const goal = this.store.data.goals.find(g => g.id === id);
        if (goal && newTitle && newTitle !== goal.title) {
          goal.title = newTitle;
          this.store.save();
          this.renderSidebar();
        }
      });
      span.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          span.blur();
        }
      });
    });
  }

  renderFocusCards() {
    const critical = this.store.data.tasks
      .filter(t => t.status !== 'completed' && t.priority === 'high')
      .sort((a, b) => {
        if (!a.due && !b.due) return 0;
        if (!a.due) return 1;
        if (!b.due) return -1;
        return a.due.localeCompare(b.due);
      })
      .slice(0, 4);

    if (critical.length === 0) {
        return `<div class="text-tertiary font-medium">No critical tasks identified for focus. Low-intensity mode active.</div>`;
    }

    return critical.map(task => {
        const p = this.store.data.projects.find(proj => proj.id === task.projectId);
        return `
            <div class="focus-card dashboard-project-row" data-id="${p ? p.id : ''}">
                <div class="focus-card-header">
                    <span class="focus-tag" style="background: var(--accent-red-bg); color: var(--accent-red-text);">
                        CRITICAL
                    </span>
                    <span class="text-xs text-tertiary">${p ? p.title : ''}</span>
                </div>
                <div class="font-bold text-sm truncate">${task.title}</div>
                <div class="text-xs text-tertiary truncate">${task.notes || 'No details...'}</div>
            </div>
        `;
    }).join('');
  }

  renderDayView(type) {
    const todayDate = new Date();
    const formatDate = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    
    let targetDateStr = '';
    let title = '';
    let icon = '';

    if (type === 'today') {
      targetDateStr = formatDate(todayDate);
      title = 'Today';
      icon = '<span class="icon dot blue">●</span>';
    } else if (type === 'tomorrow') {
      const tomorrow = new Date(todayDate);
      tomorrow.setDate(tomorrow.getDate() + 1);
      targetDateStr = formatDate(tomorrow);
      title = 'Tomorrow';
      icon = '<span class="icon dot yellow">●</span>';
    } else if (type === 'yesterday') {
      const yesterday = new Date(todayDate);
      yesterday.setDate(yesterday.getDate() - 1);
      targetDateStr = formatDate(yesterday);
      title = 'Yesterday';
      icon = '<span class="icon dot red">●</span>';
    } else if (type === 'thisweek') {
      title = 'This Week';
      icon = '<span class="icon dot purple">●</span>';
    }

    let matches = [];
    if (type === 'overdue') {
      matches = this.store.data.tasks.filter(t => this.store.isTaskOverdue(t));
      title = 'Overdue';
      icon = '<span class="icon warning">⚠️</span>';
    } else if (type === 'thisweek') {
      const d = new Date(todayDate);
      const day = d.getDay();
      const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday
      const monday = new Date(d.setDate(diff));
      monday.setHours(0,0,0,0);
      
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      sunday.setHours(23,59,59,999);
      
      matches = this.store.data.tasks.filter(t => {
        if (!t.due) return false;
        const dueDate = new Date(t.due);
        return dueDate >= monday && dueDate <= sunday;
      });
      // Sort this week tasks by due date
      matches.sort((a,b) => a.due.localeCompare(b.due));
    } else {
      matches = this.store.data.tasks.filter(t => t.due === targetDateStr);
    }

    this.mainView.innerHTML = `
      <div class="animate-fade">
        <header class="content-header">
           <h3 class="section-title" style="padding: 0; margin-bottom: 8px;">DASHBOARD VIEW</h3>
           <h1 class="project-title-large">${icon} ${title}</h1>
           <div class="text-xs text-gray-400">${matches.length} tasks matching this view</div>
        </header>

        <div class="tasks-container">
          ${this.renderGroupedTaskList(matches)}
        </div>
      </div>
    `;

    this.bindTaskEvents(matches);
  }

  renderDateView(dateStr) {
    const date = new Date(dateStr);
    const formattedDate = new Intl.DateTimeFormat('en-US', { dateStyle: 'full' }).format(date);
    
    const matches = this.store.data.tasks.filter(t => t.due === dateStr);

    this.mainView.innerHTML = `
      <div class="animate-fade">
        <header class="content-header">
           <h3 class="section-title" style="padding: 0; margin-bottom: 8px;">CALENDAR VIEW</h3>
           <h1 class="project-title-large">${formattedDate}</h1>
           <div class="text-xs text-gray-400">${matches.length} tasks scheduled for this day</div>
        </header>

        <div class="tasks-container">
          ${this.renderGroupedTaskList(matches)}
        </div>
      </div>
    `;

    this.bindTaskEvents(matches);
  }

  renderProjectView(projectId) {
    const project = this.store.data.projects.find(p => p.id === projectId);
    if (!project) return this.renderDashboard();

    const goal = this.store.data.goals.find(g => g.id === project.goalId);
    const goalIndex = this.store.data.goals.findIndex(g => g.id === (goal ? goal.id : ''));
    const goalColors = [
      'rgba(59, 130, 246, 0.06)', // L-Blue
      'rgba(139, 92, 246, 0.06)', // L-Purple
      'rgba(16, 185, 129, 0.06)', // L-Green
      'rgba(245, 158, 11, 0.06)', // L-Amber
      'rgba(239, 68, 68, 0.06)',  // L-Red
      'rgba(107, 114, 128, 0.06)' // L-Gray
    ];
    const color = goalIndex !== -1 ? goalColors[goalIndex % goalColors.length] : 'transparent';

    const tasks = this.store.data.tasks.filter(t => t.projectId === projectId);
    const progress = this.store.getProjectProgress(projectId);

    this.mainView.innerHTML = `
      <div class="animate-fade project-focus-container" style="background-color: ${color}; border-radius: var(--radius-lg); padding: 32px; border: 1px solid ${color.replace('0.06', '0.12')}">
        <header class="content-header">
          <div class="breadcrumbs">${goal ? goal.title : 'No Goal'} / ${project.title}</div>
          <div class="flex-row items-center justify-between">
             <h1 class="project-title-large" style="margin-bottom: 0;" contenteditable="true" id="proj-title-editable">${project.title}</h1>
             <i class="ph ph-dots-three-outline" id="project-options-btn"></i>
          </div>
        </header>

        <section class="progress-section-group">
          <div class="progress-container">
            <div class="progress-bar-track">
              <div class="progress-bar-fill" style="width: ${progress}%"></div>
            </div>
            <span class="progress-text">${progress}%</span>
          </div>

          <div class="time-summary-banner">
             <div class="summary-item">
                <span class="label">ESTIMATED</span>
                <span class="value">${tasks.reduce((sum, t) => sum + (t.estimatedTime || 0), 0)}h</span>
             </div>
             <div class="summary-item">
                <span class="label">SPENT</span>
                <span class="value">${tasks.reduce((sum, t) => sum + (t.spentTime || 0), 0)}h</span>
             </div>
             <div class="summary-item">
                <span class="label">EFFICIENCY</span>
                <span class="value">${tasks.reduce((sum, t) => sum + (t.estimatedTime || 0), 0) > 0 ? Math.round((tasks.reduce((sum, t) => sum + (t.spentTime || 0), 0) / tasks.reduce((sum, t) => sum + (t.estimatedTime || 0), 0)) * 100) : 0}%</span>
             </div>
          </div>
        </section>

        <section class="task-input-section">
          <textarea class="textarea-notes" id="proj-notes" rows="1" placeholder="Project notes...">${project.notes || ''}</textarea>
          
          <div class="task-input-wrapper">
            <input type="text" class="input-task-main" id="add-task-input" placeholder="Add a task and press Enter...">
          </div>
        </section>

        <div class="tasks-container" id="project-tasks-list">
          ${this.renderGroupedTaskList(tasks, project.id)}
        </div>
      </div>
    `;

    // Project Events
    const titleEdit = document.getElementById('proj-title-editable');
    titleEdit.addEventListener('blur', () => {
      project.title = titleEdit.textContent;
      this.store.save();
      this.renderSidebar();
    });

    const notesEdit = document.getElementById('proj-notes');
    const autoResize = () => {
      notesEdit.style.height = 'auto';
      notesEdit.style.height = notesEdit.scrollHeight + 'px';
    };
    
    notesEdit.addEventListener('input', () => {
      project.notes = notesEdit.value;
      this.store.save();
      autoResize();
    });
    
    // Initial resize to fit existing content
    setTimeout(autoResize, 0);

    document.getElementById('add-task-input').addEventListener('keypress', (e) => {
      if (e.key === 'Enter' && e.target.value.trim()) {
        this.store.data.tasks.push({
          id: this.store.generateId('t'),
          projectId: project.id,
          title: e.target.value.trim(),
          status: 'planned',
          due: '',
          notes: '',
          expanded: false
        });
        e.target.value = '';
        this.store.save();
        this.render();
      }
    });

    this.bindTaskEvents(tasks);
  }

  renderGoalsListView() {
    this.mainView.innerHTML = `
      <div class="animate-fade">
        <header class="content-header">
           <h3 class="section-title" style="padding: 0; margin-bottom: 8px;">DASHBOARD VIEW</h3>
           <h1 class="project-title-large"><i class="ph ph-target"></i> GOALS</h1>
        </header>
        
        <div id="all-goals-list" class="all-goals-list">
             <!-- Dynamically injected -->
        </div>
      </div>
    `;

    const container = document.getElementById('all-goals-list');
    let allTasksInView = [];

    this.store.data.goals.forEach((goal, i) => {
      const gProjs = this.store.data.projects.filter(p => p.goalId === goal.id && !p.archived);

      const gEl = document.createElement('div');
      gEl.className = 'goal-view-section';
      
      const goalColors = [
        { bg: 'rgba(59, 130, 246, 0.12)', text: '#3B82F6' },
        { bg: 'rgba(139, 92, 246, 0.12)', text: '#8B5CF6' },
        { bg: 'rgba(16, 185, 129, 0.12)', text: '#10B981' },
        { bg: 'rgba(245, 158, 11, 0.12)', text: '#F59E0B' },
        { bg: 'rgba(239, 68, 68, 0.12)', text: '#EF4444' },
        { bg: 'rgba(107, 114, 128, 0.12)', text: '#6B7280' }
      ];
      const colorSet = goalColors[i % goalColors.length];

      const gHeader = document.createElement('div');
      gHeader.className = 'goal-view-header';
      gHeader.innerHTML = `
        <span class="goal-view-title" contenteditable="true" style="background-color: ${colorSet.bg}; color: ${colorSet.text}; border-color: ${colorSet.bg}">${goal.title}</span>
        <div class="goal-view-line" style="background-color: ${colorSet.bg}"></div>
        <div class="goal-view-controls">
          <button class="icon-btn delete-goal" title="Delete Goal"><i class="ph ph-trash"></i></button>
        </div>
      `;
      gEl.appendChild(gHeader);

      gHeader.querySelector('.delete-goal').addEventListener('click', () => {
        if (confirm(`Delete goal "${goal.title}" and all its projects?`)) {
          this.store.data.projects = this.store.data.projects.filter(p => p.goalId !== goal.id);
          this.store.data.goals = this.store.data.goals.filter(g => g.id !== goal.id);
          this.store.save();
          this.render();
        }
      });

      // Edit Goal Title
      const titleSpan = gHeader.querySelector('.goal-view-title');
      titleSpan.addEventListener('blur', (e) => {
        const newTitle = e.target.innerText.trim();
        if (newTitle && newTitle !== goal.title) {
          goal.title = newTitle;
          this.store.save();
          // Minimal refresh - just update sidebar if needed
          this.renderSidebar();
        }
      });
      titleSpan.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          titleSpan.blur();
        }
      });

      gProjs.forEach(proj => {
        const pTasks = this.store.data.tasks.filter(t => t.projectId === proj.id);
        allTasksInView = allTasksInView.concat(pTasks);

        const pEl = document.createElement('div');
        pEl.className = 'proj-view-section';
        
        pEl.innerHTML = `
          <div class="proj-view-header" data-id="${proj.id}">
             <div class="proj-view-meta">
               <h3 class="proj-view-title">${proj.title}</h3>
               <span class="proj-view-progress">${this.store.getProjectProgress(proj.id)}%</span>
             </div>
             <div class="proj-view-controls flex-row gap-2">
                <button class="icon-btn archive-project" title="Archive Project"><i class="ph ph-archive-box"></i></button>
                <button class="icon-btn delete-project" title="Delete Project"><i class="ph ph-x"></i></button>
                <i class="ph ph-arrow-right"></i>
             </div>
          </div>
          <div class="tasks-container">
            ${this.renderGroupedTaskList(pTasks, proj.id)}
          </div>
        `;

        pEl.querySelector('.proj-view-header').addEventListener('click', (e) => {
          if (e.target.closest('.delete-project') || e.target.closest('.archive-project')) return;
          this.store.data.activeView = proj.id;
          this.store.save();
          this.render();
        });

        pEl.querySelector('.archive-project').addEventListener('click', (e) => {
          e.stopPropagation();
          proj.archived = true;
          this.store.save();
          this.render();
        });

        pEl.querySelector('.delete-project').addEventListener('click', (e) => {
          e.stopPropagation();
          if (confirm(`Delete project "${proj.title}"?`)) {
             this.store.data.projects = this.store.data.projects.filter(p => p.id !== proj.id);
             this.store.data.tasks = this.store.data.tasks.filter(t => t.projectId !== proj.id);
             this.store.save();
             this.render();
          }
        });

        gEl.appendChild(pEl);
      });

      const addProjBtn = document.createElement('button');
      addProjBtn.className = 'add-project-btn-large';
      addProjBtn.innerHTML = `<i class="ph ph-plus-circle"></i> Add Project to ${goal.title}`;
      addProjBtn.addEventListener('click', () => {
          const pId = this.store.generateId('p');
          this.store.data.projects.push({ id: pId, goalId: goal.id, title: 'New Project', notes: '' });
          this.store.data.activeView = pId;
          this.store.save();
          this.render();
      });
      gEl.appendChild(addProjBtn);

      container.appendChild(gEl);
    });

    const addGoalFooter = document.createElement('div');
    addGoalFooter.className = 'mt-12 pt-8 text-center border-t border-light';
    addGoalFooter.innerHTML = `
        <button class="add-goal-btn-large">+ Create New Goal</button>
    `;
    addGoalFooter.querySelector('button').addEventListener('click', () => {
        const gId = this.store.generateId('g');
        this.store.data.goals.push({ id: gId, title: 'New Goal', projects: [], collapsed: false });
        this.store.save();
        this.render();
    });
    container.appendChild(addGoalFooter);

    this.bindTaskEvents(allTasksInView);
  }

  renderArchiveView() {
    this.mainView.innerHTML = `
      <div class="animate-fade">
        <header class="content-header">
           <h3 class="section-title" style="padding: 0; margin-bottom: 8px;">DASHBOARD VIEW</h3>
           <h1 class="project-title-large"><i class="ph ph-archive"></i> ARCHIVE</h1>
        </header>
        
        <div id="archive-list" class="all-goals-list">
             <!-- Dynamically injected -->
        </div>
      </div>
    `;

    const container = document.getElementById('archive-list');
    const archivedProjsTotal = this.store.data.projects.filter(p => p.archived);

    if (archivedProjsTotal.length === 0) {
      container.innerHTML = `<div class="text-center py-24 text-tertiary">No archived projects found</div>`;
      return;
    }

    const goalColors = [
      { bg: 'rgba(59, 130, 246, 0.12)', text: '#3B82F6' },
      { bg: 'rgba(139, 92, 246, 0.12)', text: '#8B5CF6' },
      { bg: 'rgba(16, 185, 129, 0.12)', text: '#10B981' },
      { bg: 'rgba(245, 158, 11, 0.12)', text: '#F59E0B' },
      { bg: 'rgba(239, 68, 68, 0.12)', text: '#EF4444' },
      { bg: 'rgba(107, 114, 128, 0.12)', text: '#6B7280' }
    ];

    // Group by Goal
    this.store.data.goals.forEach((goal, i) => {
      const gProjs = archivedProjsTotal.filter(p => p.goalId === goal.id);
      if (gProjs.length === 0) return;

      const colorSet = goalColors[i % goalColors.length];
      const gEl = document.createElement('div');
      gEl.className = 'goal-view-section';
      
      const gHeader = document.createElement('div');
      gHeader.className = 'goal-view-header';
      gHeader.innerHTML = `
        <span class="goal-view-title" style="background-color: ${colorSet.bg}; color: ${colorSet.text}; border-color: ${colorSet.bg}">${goal.title}</span>
        <div class="goal-view-line" style="background-color: ${colorSet.bg}"></div>
      `;
      gEl.appendChild(gHeader);

      gProjs.forEach(proj => {
        const pEl = document.createElement('div');
        pEl.className = 'proj-view-section archived';
        
        pEl.innerHTML = `
          <div class="proj-view-header" data-id="${proj.id}">
             <div class="proj-view-meta">
               <h3 class="proj-view-title">${proj.title}</h3>
               <span class="proj-view-progress">Archived</span>
             </div>
             <div class="proj-view-controls flex-row gap-2">
                <button class="icon-btn unarchive-project" title="Unarchive Project"><i class="ph ph-arrow-u-up-left"></i></button>
                <button class="icon-btn delete-project" title="Delete Permanently"><i class="ph ph-trash"></i></button>
             </div>
          </div>
        `;

        pEl.querySelector('.unarchive-project').addEventListener('click', (e) => {
          e.stopPropagation();
          proj.archived = false;
          this.store.save();
          this.render();
        });

        pEl.querySelector('.delete-project').addEventListener('click', (e) => {
          e.stopPropagation();
          if (confirm(`Delete project "${proj.title}" permanently?`)) {
             this.store.data.projects = this.store.data.projects.filter(p => p.id !== proj.id);
             this.store.data.tasks = this.store.data.tasks.filter(t => t.projectId !== proj.id);
             this.store.save();
             this.render();
          }
        });

        gEl.appendChild(pEl);
      });

      container.appendChild(gEl);
    });

    // Handle projects whose goal was deleted or missing goalId
    const goalIds = this.store.data.goals.map(g => g.id);
    const orphanedProjs = archivedProjsTotal.filter(p => !goalIds.includes(p.goalId));
    
    if (orphanedProjs.length > 0) {
      const gEl = document.createElement('div');
      gEl.className = 'goal-view-section';
      
      const gHeader = document.createElement('div');
      gHeader.className = 'goal-view-header';
      gHeader.innerHTML = `
        <span class="goal-view-title" style="background-color: rgba(107, 114, 128, 0.12); color: #6B7280; border-color: rgba(107, 114, 128, 0.12)">Other / Orphaned</span>
        <div class="goal-view-line" style="background-color: rgba(107, 114, 128, 0.12)"></div>
      `;
      gEl.appendChild(gHeader);

      orphanedProjs.forEach(proj => {
        const pEl = document.createElement('div');
        pEl.className = 'proj-view-section archived';
        
        pEl.innerHTML = `
          <div class="proj-view-header" data-id="${proj.id}">
             <div class="proj-view-meta">
               <h3 class="proj-view-title">${proj.title}</h3>
               <span class="proj-view-progress">Archived</span>
             </div>
             <div class="proj-view-controls flex-row gap-2">
                <button class="icon-btn unarchive-project" title="Unarchive Project"><i class="ph ph-arrow-u-up-left"></i></button>
                <button class="icon-btn delete-project" title="Delete Permanently"><i class="ph ph-trash"></i></button>
             </div>
          </div>
        `;

        pEl.querySelector('.unarchive-project').addEventListener('click', (e) => {
          e.stopPropagation();
          proj.archived = false;
          this.store.save();
          this.render();
        });

        pEl.querySelector('.delete-project').addEventListener('click', (e) => {
          e.stopPropagation();
          if (confirm(`Delete project "${proj.title}" permanently?`)) {
             this.store.data.projects = this.store.data.projects.filter(p => p.id !== proj.id);
             this.store.data.tasks = this.store.data.tasks.filter(t => t.projectId !== proj.id);
             this.store.save();
             this.render();
          }
        });

        gEl.appendChild(pEl);
      });

      container.appendChild(gEl);
    }
  }

  renderGroupedTaskList(tasks, projectId = null) {
    if (!tasks.length) return `<div class="text-center py-12 text-tertiary font-medium">No tasks found</div>`;
    
    const groups = {
      'in-progress': tasks.filter(t => t.status === 'in-progress'),
      'planned': tasks.filter(t => t.status === 'planned'),
      'completed': tasks.filter(t => t.status === 'completed')
    };
    
    const renderSection = (title, tasks, iconClass, colorClass, isCollapsible = false) => {
      if (tasks.length === 0) return '';
      
      let isCollapsed = false;
      if (isCollapsible && projectId) {
        const proj = this.store.data.projects.find(p => p.id === projectId);
        isCollapsed = proj ? !!proj.completedCollapsed : false;
      }

      const sorted = [...tasks].sort((a,b) => { 
        if(!a.due&&!b.due) return 0; 
        if(!a.due) return 1; 
        if(!b.due) return -1; 
        return a.due.localeCompare(b.due); 
      });

      return `
        <div class="task-group ${colorClass} ${isCollapsed ? 'collapsed' : ''}" data-context="${isCollapsible ? (projectId || '') : ''}">
          <h4 class="group-header">
            ${isCollapsible ? `<i class="ph ph-caret-down toggle-group"></i>` : ''}
            <i class="ph-bold ${iconClass}"></i> ${title} <span class="group-count">${tasks.length}</span>
          </h4>
          <div class="group-content">
            ${this.renderTaskList(sorted)}
          </div>
        </div>
      `;
    };

    return (
      renderSection('In Progress', groups['in-progress'], 'ph-clock-countdown', 'doing') +
      renderSection('Planned', groups['planned'], 'ph-calendar-blank', 'planned') +
      renderSection('Completed', groups['completed'], 'ph-check-circle', 'done', true)
    );
  }

  renderTaskList(tasks) {
    if (!tasks.length) return `<div class="text-center py-12 text-tertiary font-medium">No tasks found</div>`;
    
    return tasks.map(t => {
      const isOverdue = this.store.isTaskOverdue(t);
      return `
        <div class="task-card ${t.status === 'completed' ? 'completed' : ''} ${isOverdue ? 'overdue' : ''} ${t.blocked ? 'blocked' : ''}" data-id="${t.id}">
          <div class="task-row">
            <input type="checkbox" class="task-checkbox" ${t.status === 'completed' ? 'checked' : ''}>
            <div class="task-content-main">
              <input type="text" class="task-text" value="${t.title}">
              <div class="task-meta-row">
                <select class="priority-select priority-${t.priority || 'medium'}">
                  <option value="high" ${t.priority === 'high' ? 'selected' : ''}>High</option>
                  <option value="medium" ${t.priority === 'medium' || !t.priority ? 'selected' : ''}>Med</option>
                  <option value="low" ${t.priority === 'low' ? 'selected' : ''}>Low</option>
                </select>
                ${t.estimatedTime ? `<span class="task-time-badge ${t.spentTime > t.estimatedTime ? 'over-estimated' : ''}">
                  <i class="ph ph-timer"></i> ${t.spentTime || 0} / ${t.estimatedTime}h
                </span>` : ''}
              </div>
            </div>
            
            <div class="task-controls">
              <button class="icon-btn blocker-btn ${t.blocked ? 'is-blocked' : ''}" title="Toggle Blocker"><i class="ph ph-prohibit"></i></button>
              
              <div class="time-inputs">
                <input type="number" class="time-val est" placeholder="Est.h" value="${t.estimatedTime || ''}" title="Estimated Hours">
                <input type="number" class="time-val spent" placeholder="Spent" value="${t.spentTime || ''}" title="Spent Hours">
              </div>

              <select class="task-status-select status-${t.status}">
                <option value="planned" ${t.status === 'planned' ? 'selected' : ''}>Planned</option>
                <option value="in-progress" ${t.status === 'in-progress' ? 'selected' : ''}>In Progress</option>
                <option value="completed" ${t.status === 'completed' ? 'selected' : ''}>Completed</option>
              </select>
              
              <input type="date" class="input-date ${isOverdue ? 'overdue' : ''}" value="${t.due || ''}">
              
              <button class="icon-btn toggle-task-notes"><i class="ph ph-note-pencil"></i></button>
              <button class="icon-btn delete-task"><i class="ph ph-x"></i></button>
            </div>
          </div>
          <div class="task-notes-reveal" style="display: ${t.expanded ? 'block' : 'none'}">
            <textarea class="task-notes-area" placeholder="Task details...">${t.notes || ''}</textarea>
          </div>
        </div>
      `;
    }).join('');
  }

  bindTaskEvents(tasks) {
    tasks.forEach(task => {
      const el = document.querySelector(`.task-card[data-id="${task.id}"]`);
      if (!el) return;

      el.querySelector('.task-checkbox').addEventListener('change', (e) => {
        task.status = e.target.checked ? 'completed' : 'planned';
        this.store.save();
        this.render();
      });

      el.querySelector('.task-text').addEventListener('change', (e) => {
        task.title = e.target.value;
        this.store.save();
      });

      el.querySelector('.task-status-select').addEventListener('change', (e) => {
        task.status = e.target.value;
        this.store.save();
        this.render();
      });

      el.querySelector('.input-date').addEventListener('change', (e) => {
        task.due = e.target.value;
        this.store.save();
        this.render();
      });

      el.querySelector('.time-val.est').addEventListener('change', (e) => {
        task.estimatedTime = parseFloat(e.target.value) || 0;
        this.store.save();
        this.render();
      });

      el.querySelector('.time-val.spent').addEventListener('change', (e) => {
        task.spentTime = parseFloat(e.target.value) || 0;
        this.store.save();
        this.render();
      });

      el.querySelector('.toggle-task-notes').addEventListener('click', () => {
        task.expanded = !task.expanded;
        this.store.save();
        this.render();
      });

      el.querySelector('.priority-select').addEventListener('change', (e) => {
        task.priority = e.target.value;
        this.store.save();
        this.render();
      });

      el.querySelector('.blocker-btn').addEventListener('click', () => {
        task.blocked = !task.blocked;
        this.store.save();
        this.render();
      });

      el.querySelector('.task-notes-area').addEventListener('input', (e) => {
        task.notes = e.target.value;
        this.store.save();
      });

      el.querySelector('.delete-task').addEventListener('click', () => {
        this.store.data.tasks = this.store.data.tasks.filter(t => t.id !== task.id);
        this.store.save();
        this.render();
      });
    });
  }
}

// Global Initialization
document.addEventListener('DOMContentLoaded', () => {
  const store = new Store();
  const ui = new UI(store);
});
