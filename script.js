/**
 * Premium Task Manager - Vanilla JS Core
 * Features: Dashboard, Day Views, Goal/Project CRUD, Task Expansion, LocalStorage persistence.
 */

class Store {
  constructor() {
    this.STORAGE_KEY = 'workspace_tasks_db_v3';
    this.data = this.load() || this.getDefaultData();
    this.saveStatus = ''; // 'saving', 'saved', 'error'
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
    this.goalsContainer = document.getElementById('goals-container');
    this.saveIndicator = document.getElementById('save-status');
    this.themeToggle = document.getElementById('theme-toggle');
    
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
  }

  applyTheme() {
    const theme = this.store.data.theme || 'light';
    document.body.setAttribute('data-theme', theme);
    const icon = this.themeToggle.querySelector('i');
    icon.className = theme === 'dark' ? 'ph ph-sun' : 'ph ph-moon';
  }

  render() {
    this.renderSidebar();
    
    // Determine which main view to render
    const view = this.store.data.activeView;
    if (view === 'dashboard') this.renderDashboard();
    else if (['overdue', 'today', 'tomorrow', 'yesterday', 'thisweek'].includes(view)) this.renderDayView(view);
    else this.renderProjectView(view);
  }

  renderSidebar() {
    this.goalsContainer.innerHTML = '';
    
    // Highlight active dashboard link
    document.querySelectorAll('.nav-item').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.view === this.store.data.activeView);
    });

    this.store.data.goals.forEach(goal => {
      const gEl = document.createElement('div');
      gEl.className = 'goal-group';
      
      const projs = this.store.data.projects.filter(p => p.goalId === goal.id);
      const isCollapsed = goal.collapsed || false;
      
      gEl.innerHTML = `
        <div class="goal-header ${isCollapsed ? 'collapsed' : ''}" data-id="${goal.id}">
          <i class="ph-bold ph-caret-down caret"></i>
          <input type="text" class="goal-title-input" value="${goal.title}">
          <div class="goal-controls">
            <button class="icon-btn delete-goal" title="Delete Goal"><i class="ph ph-trash"></i></button>
          </div>
        </div>
        <div class="project-list" style="display: ${isCollapsed ? 'none' : 'block'}">
          ${projs.map(p => `
            <div class="project-item ${p.id === this.store.data.activeView ? 'active' : ''}" data-id="${p.id}">
              <input type="text" class="project-title-input" value="${p.title}">
              <div class="project-controls">
                <button class="icon-btn delete-project"><i class="ph ph-x"></i></button>
              </div>
            </div>
          `).join('')}
          <button class="add-project-btn" data-goal-id="${goal.id}">+ project</button>
        </div>
      `;

      // Sidebar Events
      gEl.querySelector('.caret').addEventListener('click', (e) => {
        e.stopPropagation();
        goal.collapsed = !goal.collapsed;
        this.store.save();
        this.renderSidebar();
      });

      gEl.querySelector('.goal-title-input').addEventListener('change', (e) => {
        goal.title = e.target.value;
        this.store.save();
      });

      gEl.querySelector('.delete-goal').addEventListener('click', (e) => {
        e.stopPropagation();
        if (confirm(`Delete goal "${goal.title}" and all its projects?`)) {
          this.store.data.projects = this.store.data.projects.filter(p => p.goalId !== goal.id);
          this.store.data.goals = this.store.data.goals.filter(g => g.id !== goal.id);
          this.store.data.activeView = 'dashboard';
          this.store.save();
          this.render();
        }
      });

      gEl.querySelectorAll('.project-item').forEach(pItem => {
        const pId = pItem.dataset.id;
        const project = this.store.data.projects.find(p => p.id === pId);

        pItem.addEventListener('click', (e) => {
          if (e.target.classList.contains('project-title-input')) return;
          this.store.data.activeView = pId;
          this.store.save();
          this.render();
        });

        pItem.querySelector('.project-title-input').addEventListener('change', (e) => {
          project.title = e.target.value;
          this.store.save();
          if (this.store.data.activeView === pId) this.render(); // Update breadcrumbs if active
        });

        pItem.querySelector('.delete-project').addEventListener('click', (e) => {
          e.stopPropagation();
          const pId = pItem.dataset.id;
          this.store.data.projects = this.store.data.projects.filter(p => p.id !== pId);
          this.store.data.tasks = this.store.data.tasks.filter(t => t.projectId !== pId);
          if (this.store.data.activeView === pId) this.store.data.activeView = 'dashboard';
          this.store.save();
          this.render();
        });
      });

      gEl.querySelector('.add-project-btn').addEventListener('click', () => {
        const pId = this.store.generateId('p');
        this.store.data.projects.push({ id: pId, goalId: goal.id, title: 'New Project', notes: '' });
        this.store.data.activeView = pId;
        this.store.save();
        this.render();
      });

      this.goalsContainer.appendChild(gEl);
    });
  }

  // --- Main Views ---

  renderDashboard() {
    const totalTasks = this.store.data.tasks;
    const completed = totalTasks.filter(t => t.status === 'completed').length;
    const inProgress = totalTasks.filter(t => t.status === 'in-progress').length;

    this.mainView.innerHTML = `
      <div class="animate-fade">
        <header class="content-header">
           <h1 class="project-title-large">Dashboard</h1>
        </header>
        
        <div class="dashboard-metrics">
          <div class="metric-card">
            <div class="metric-val">${this.store.data.goals.length}</div>
            <div class="metric-label">Goals</div>
          </div>
          <div class="metric-card">
            <div class="metric-val">${this.store.data.projects.length}</div>
            <div class="metric-label">Projects</div>
          </div>
          <div class="metric-card">
            <div class="metric-val">${totalTasks.length}</div>
            <div class="metric-label">Tasks</div>
          </div>
          <div class="metric-card">
            <div class="metric-val text-blue">${inProgress}</div>
            <div class="metric-label">Doing</div>
          </div>
          <div class="metric-card">
            <div class="metric-val text-green">${completed}</div>
            <div class="metric-label">Done</div>
          </div>
        </div>

        <div class="dashboard-grid">
          ${this.store.data.goals.map(goal => `
            <div class="dashboard-goal-card">
              <div class="goal-card-header">
                <span class="goal-card-title">${goal.title}</span>
                <span class="progress-text">${this.store.getGoalProgress(goal.id)}%</span>
              </div>
              <div class="progress-bar-track">
                <div class="progress-bar-fill" style="width: ${this.store.getGoalProgress(goal.id)}%"></div>
              </div>
              <div class="mt-4">
                ${this.store.data.projects.filter(p => p.goalId === goal.id).map(p => `
                  <a href="#" class="dashboard-project-row" data-id="${p.id}">
                    <div class="project-row-top">
                      <span>${p.title}</span>
                      <span class="project-row-tasks">${p.tasks ? p.tasks.length : 0} tasks</span>
                    </div>
                    <div class="progress-bar-track" style="height: 3px;">
                      <div class="progress-bar-fill" style="width: ${this.store.getProjectProgress(p.id)}%"></div>
                    </div>
                  </a>
                `).join('')}
              </div>
            </div>
          `).join('')}
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
  }

  renderDayView(type) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    let targetDateStr = '';
    let title = '';
    let icon = '';

    if (type === 'today') {
      targetDateStr = today.toISOString().split('T')[0];
      title = 'Today';
      icon = '<span class="icon dot blue">●</span>';
    } else if (type === 'tomorrow') {
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      targetDateStr = tomorrow.toISOString().split('T')[0];
      title = 'Tomorrow';
      icon = '<span class="icon dot yellow">●</span>';
    } else if (type === 'yesterday') {
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      targetDateStr = yesterday.toISOString().split('T')[0];
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
      const d = new Date(today);
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

  renderProjectView(projectId) {
    const project = this.store.data.projects.find(p => p.id === projectId);
    if (!project) return this.renderDashboard();

    const goal = this.store.data.goals.find(g => g.id === project.goalId);
    const tasks = this.store.data.tasks.filter(t => t.projectId === projectId);
    const progress = this.store.getProjectProgress(projectId);

    this.mainView.innerHTML = `
      <div class="animate-fade">
        <header class="content-header">
          <div class="breadcrumbs">${goal ? goal.title : ''}</div>
          <h1 class="project-title-large" contenteditable="true" id="proj-title-editable">${project.title}</h1>
          
          <div class="progress-container">
            <div class="progress-bar-track">
              <div class="progress-bar-fill" style="width: ${progress}%"></div>
            </div>
            <span class="progress-text">${progress}%</span>
          </div>
        </header>

        <section class="task-input-section">
          <textarea class="textarea-notes" id="proj-notes" rows="1" placeholder="Project notes...">${project.notes || ''}</textarea>
          
          <div class="task-input-wrapper">
            <input type="text" class="input-task-main" id="add-task-input" placeholder="Add a task and press Enter...">
          </div>
        </section>

        <div class="tasks-container" id="project-tasks-list">
          ${this.renderGroupedTaskList(tasks)}
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

  renderGroupedTaskList(tasks) {
    if (!tasks.length) return `<div class="text-center py-12 text-tertiary font-medium">No tasks found</div>`;
    
    const groups = {
      'in-progress': tasks.filter(t => t.status === 'in-progress'),
      'planned': tasks.filter(t => t.status === 'planned'),
      'completed': tasks.filter(t => t.status === 'completed')
    };
    
    const renderSection = (title, tasks, iconClass, colorClass) => {
      if (tasks.length === 0) return '';
      // Sort each group internally by due date (or by goal/project title)
      const sorted = [...tasks].sort((a,b) => { 
        if(!a.due&&!b.due) return 0; 
        if(!a.due) return 1; 
        if(!b.due) return -1; 
        return a.due.localeCompare(b.due); 
      });

      return `
        <div class="task-group ${colorClass}">
          <h4 class="group-header"><i class="ph-bold ${iconClass}"></i> ${title} <span class="group-count">${tasks.length}</span></h4>
          ${this.renderTaskList(sorted)}
        </div>
      `;
    };

    return (
      renderSection('In Progress', groups['in-progress'], 'ph-clock-countdown', 'doing') +
      renderSection('Planned', groups['planned'], 'ph-calendar-blank', 'planned') +
      renderSection('Completed', groups['completed'], 'ph-check-circle', 'done')
    );
  }

  renderTaskList(tasks) {
    if (!tasks.length) return `<div class="text-center py-12 text-tertiary font-medium">No tasks found</div>`;
    
    return tasks.map(t => {
      const isOverdue = this.store.isTaskOverdue(t);
      return `
        <div class="task-card ${t.status === 'completed' ? 'completed' : ''} ${isOverdue ? 'overdue' : ''}" data-id="${t.id}">
          <div class="task-row">
            <input type="checkbox" class="task-checkbox" ${t.status === 'completed' ? 'checked' : ''}>
            <input type="text" class="task-text" value="${t.title}">
            
            <div class="task-controls">
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

      el.querySelector('.toggle-task-notes').addEventListener('click', () => {
        task.expanded = !task.expanded;
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
