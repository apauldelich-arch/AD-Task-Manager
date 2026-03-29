import { useState, useEffect, useRef } from "react";

const STORAGE_KEY = "goal_tracker_v2";

const defaultData = {
  goals: [{
    id: "g1", title: "Example Goal", notes: "",
    projects: [{
      id: "p1", title: "Example Project", notes: "",
      tasks: [{ id: "t1", title: "My first task", status: "planned", due: "", notes: "" }]
    }]
  }]
};

const STATUS = ["planned", "in-progress", "completed"];
const STATUS_LABEL = { "planned": "Planned", "in-progress": "In Progress", "completed": "Completed" };
const STATUS_COLOR = { "planned": "bg-slate-100 text-slate-600", "in-progress": "bg-blue-100 text-blue-700", "completed": "bg-green-100 text-green-700" };

function uid() { return Math.random().toString(36).slice(2, 9); }
function calcProjectProgress(p) { if (!p.tasks.length) return 0; return Math.round(p.tasks.filter(t => t.status === "completed").length / p.tasks.length * 100); }
function calcGoalProgress(g) { const all = g.projects.flatMap(p => p.tasks); if (!all.length) return 0; return Math.round(all.filter(t => t.status === "completed").length / all.length * 100); }
function isOverdue(due) { return due && new Date(due) < new Date(new Date().toDateString()); }

function ProgressBar({ pct, color = "bg-blue-500" }) {
  return <div className="w-full bg-gray-200 rounded-full h-1.5"><div className={`${color} h-1.5 rounded-full transition-all`} style={{ width: `${pct}%` }} /></div>;
}

export default function App() {
  const [data, setData] = useState(null);
  const [selected, setSelected] = useState(null);
  const [sidebarEdit, setSidebarEdit] = useState(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [saveStatus, setSaveStatus] = useState("");
  const [unsaved, setUnsaved] = useState(false);
  const prevDataRef = useRef(null);

  useEffect(() => {
    (async () => {
      try {
        const r = await window.storage.get(STORAGE_KEY);
        if (r && r.value) { setData(JSON.parse(r.value)); return; }
      } catch {}
      setData(defaultData);
    })();
  }, []);

  useEffect(() => {
    if (!data) return;
    if (prevDataRef.current !== null) setUnsaved(true);
    prevDataRef.current = data;
  }, [data]);

  if (!data) return <div className="flex items-center justify-center h-screen text-gray-400">Loading…</div>;

  async function handleSave() {
    setSaveStatus("saving");
    try {
      const r = await window.storage.set(STORAGE_KEY, JSON.stringify(data));
      setSaveStatus(r ? "saved" : "error");
      if (r) setUnsaved(false);
    } catch { setSaveStatus("error"); }
    setTimeout(() => setSaveStatus(""), 3000);
  }

  const selectedGoal = selected?.goalId ? data.goals.find(g => g.id === selected.goalId) : null;
  const selectedProject = selectedGoal?.projects.find(p => p.id === selected?.projectId) ?? null;

  function updateData(fn) { setData(d => { const nd = JSON.parse(JSON.stringify(d)); fn(nd); return nd; }); }

  function addGoal() {
    const id = uid();
    updateData(d => d.goals.push({ id, title: "New Goal", notes: "", projects: [] }));
    setSidebarEdit({ type: "goal", id }); setEditingTitle("New Goal");
  }

  function addProject(goalId) {
    const id = uid();
    updateData(d => d.goals.find(g => g.id === goalId)?.projects.push({ id, title: "New Project", notes: "", tasks: [] }));
    setSidebarEdit({ type: "project", id, parentId: goalId }); setEditingTitle("New Project");
    setSelected({ goalId, projectId: id });
  }

  function saveSidebarEdit() {
    if (!sidebarEdit) return;
    const { type, id, parentId } = sidebarEdit;
    if (type === "goal") updateData(d => { const g = d.goals.find(g => g.id === id); if (g) g.title = editingTitle || "Untitled"; });
    if (type === "project") updateData(d => { const p = d.goals.find(g => g.id === parentId)?.projects.find(p => p.id === id); if (p) p.title = editingTitle || "Untitled"; });
    setSidebarEdit(null);
  }

  const isDayView = ["overdue","yesterday","today","tomorrow"].includes(selected);

  return (
    <div className="flex h-screen bg-gray-50 font-sans text-sm text-gray-800 overflow-hidden">
      <aside className="w-60 bg-white border-r border-gray-200 flex flex-col flex-shrink-0 overflow-y-auto">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
          <h1 className="font-bold text-base text-gray-900">My Workspace</h1>
          <div className="flex items-center gap-1">
            {unsaved && <span className="text-xs text-amber-500">●</span>}
            {saveStatus === "saving" && <span className="text-xs text-gray-400">saving…</span>}
            {saveStatus === "saved" && <span className="text-xs text-green-500">✓</span>}
            {saveStatus === "error" && <span className="text-xs text-red-400">⚠</span>}
            <button onClick={handleSave} className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-2 py-0.5 rounded font-medium ml-1">Save</button>
          </div>
        </div>

        {[{id:null,label:"Dashboard"},{id:"overdue",label:"⚠️ Overdue"},{id:"yesterday",label:"🔴 Yesterday"},{id:"today",label:"🔵 Today"},{id:"tomorrow",label:"🟡 Tomorrow"}].map(({id,label}) => (
          <button key={String(id)} onClick={() => setSelected(id)}
            className={`text-left px-4 py-1.5 text-xs font-semibold uppercase tracking-widest ${selected===id?"text-blue-600 bg-blue-50":"text-gray-400 hover:bg-gray-50"}`}>
            {label}
          </button>
        ))}

        <div className="flex-1 px-2 py-2 space-y-1">
          {data.goals.map(goal => (
            <GoalSection key={goal.id} goal={goal} selected={selected} sidebarEdit={sidebarEdit}
              editingTitle={editingTitle} setEditingTitle={setEditingTitle}
              onSelectProject={pid => setSelected({ goalId: goal.id, projectId: pid })}
              onAddProject={() => addProject(goal.id)}
              onEditGoal={() => { setSidebarEdit({ type:"goal", id:goal.id }); setEditingTitle(goal.title); }}
              onDeleteGoal={() => { updateData(d => { d.goals = d.goals.filter(g => g.id !== goal.id); }); if (selected?.goalId===goal.id) setSelected(null); }}
              onEditProject={(pid,title) => { setSidebarEdit({ type:"project", id:pid, parentId:goal.id }); setEditingTitle(title); }}
              onDeleteProject={pid => { updateData(d => { const g=d.goals.find(g=>g.id===goal.id); g.projects=g.projects.filter(p=>p.id!==pid); }); if (selected?.projectId===pid) setSelected(null); }}
              onSaveEdit={saveSidebarEdit} setSidebarEdit={setSidebarEdit} />
          ))}
        </div>
        <div className="p-3 border-t border-gray-100">
          <button onClick={addGoal} className="w-full text-left text-xs text-blue-600 hover:text-blue-800 font-medium py-1">+ Add Goal</button>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto">
        {isDayView ? (
          <DayView day={selected} data={data}
            onUpdateTask={(gid,pid,tid,f,v) => updateData(d => { const t=d.goals.find(g=>g.id===gid)?.projects.find(p=>p.id===pid)?.tasks.find(t=>t.id===tid); if(t) t[f]=v; })}
            onDeleteTask={(gid,pid,tid) => updateData(d => { const p=d.goals.find(g=>g.id===gid)?.projects.find(p=>p.id===pid); if(p) p.tasks=p.tasks.filter(t=>t.id!==tid); })} />
        ) : !selected ? (
          <Dashboard data={data} onSelect={setSelected} />
        ) : selectedProject ? (
          <ProjectView goal={selectedGoal} project={selectedProject}
            onAddTask={title => { if(!title.trim()) return; updateData(d => { d.goals.find(g=>g.id===selected.goalId)?.projects.find(p=>p.id===selected.projectId)?.tasks.push({id:uid(),title:title.trim(),status:"planned",due:"",notes:""}); }); }}
            onUpdateTask={(tid,f,v) => updateData(d => { const t=d.goals.find(g=>g.id===selected.goalId)?.projects.find(p=>p.id===selected.projectId)?.tasks.find(t=>t.id===tid); if(t) t[f]=v; })}
            onDeleteTask={tid => updateData(d => { const p=d.goals.find(g=>g.id===selected.goalId)?.projects.find(p=>p.id===selected.projectId); if(p) p.tasks=p.tasks.filter(t=>t.id!==tid); })}
            onUpdateNotes={val => updateData(d => { const p=d.goals.find(g=>g.id===selected.goalId)?.projects.find(p=>p.id===selected.projectId); if(p) p.notes=val; })} />
        ) : (
          <div className="flex items-center justify-center h-full text-gray-400">Select a project</div>
        )}
      </main>
    </div>
  );
}

function GoalSection({ goal, selected, sidebarEdit, editingTitle, setEditingTitle, onSelectProject, onAddProject, onEditGoal, onDeleteGoal, onEditProject, onDeleteProject, onSaveEdit, setSidebarEdit }) {
  const [open, setOpen] = useState(true);
  const pct = calcGoalProgress(goal);
  return (
    <div className="mb-1">
      <div className="flex items-center gap-1 group px-2 py-1 rounded hover:bg-gray-50">
        <button onClick={() => setOpen(o=>!o)} className="text-gray-400 w-3">{open?"▾":"▸"}</button>
        {sidebarEdit?.type==="goal" && sidebarEdit?.id===goal.id ? (
          <input autoFocus className="flex-1 text-xs font-semibold border-b border-blue-400 outline-none bg-transparent" value={editingTitle} onChange={e=>setEditingTitle(e.target.value)} onBlur={onSaveEdit} onKeyDown={e=>{if(e.key==="Enter")onSaveEdit();if(e.key==="Escape")setSidebarEdit(null);}} />
        ) : (
          <span className="flex-1 text-xs font-semibold text-gray-700 truncate" onDoubleClick={onEditGoal}>{goal.title}</span>
        )}
        <span className="text-xs text-gray-400 hidden group-hover:inline">{pct}%</span>
        <button onClick={onEditGoal} className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-gray-600 text-xs">✎</button>
        <span className="w-2" />
        <button onClick={onDeleteGoal} className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 text-xs">✕</button>
      </div>
      {open && (
        <div className="ml-4 space-y-0.5">
          {goal.projects.map(proj => {
            const isSel = selected?.projectId===proj.id;
            return (
              <div key={proj.id} className={`flex items-center gap-1 group px-2 py-1 rounded cursor-pointer ${isSel?"bg-blue-50 text-blue-700":"hover:bg-gray-50 text-gray-600"}`} onClick={()=>onSelectProject(proj.id)}>
                {sidebarEdit?.type==="project" && sidebarEdit?.id===proj.id ? (
                  <input autoFocus className="flex-1 text-xs border-b border-blue-400 outline-none bg-transparent" value={editingTitle} onChange={e=>setEditingTitle(e.target.value)} onBlur={onSaveEdit} onKeyDown={e=>{if(e.key==="Enter")onSaveEdit();if(e.key==="Escape")setSidebarEdit(null);}} onClick={e=>e.stopPropagation()} />
                ) : (
                  <span className="flex-1 text-xs truncate">{proj.title}</span>
                )}
                <span className="text-xs text-gray-400 hidden group-hover:inline">{calcProjectProgress(proj)}%</span>
                <button onClick={e=>{e.stopPropagation();onEditProject(proj.id,proj.title);}} className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-gray-600 text-xs">✎</button>
                <span className="w-2" />
                <button onClick={e=>{e.stopPropagation();onDeleteProject(proj.id);}} className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 text-xs">✕</button>
              </div>
            );
          })}
          <button onClick={onAddProject} className="w-full text-left text-xs text-gray-400 hover:text-blue-600 px-2 py-0.5">+ project</button>
        </div>
      )}
    </div>
  );
}

function DayView({ day, data, onUpdateTask, onDeleteTask }) {
  const [expandedTask, setExpandedTask] = useState(null);
  const today = new Date(new Date().toDateString());

  let matches = [], title2 = "", subtitle = "";

  if (day === "overdue") {
    data.goals.forEach(g => g.projects.forEach(p => p.tasks.forEach(t => {
      if (t.due && new Date(t.due) < today && t.status !== "completed") matches.push({task:t,project:p,goal:g});
    })));
    matches.sort((a,b) => a.task.due.localeCompare(b.task.due));
    title2 = "⚠️ Overdue"; subtitle = `${matches.length} task${matches.length!==1?"s":""} past their due date`;
  } else {
    const target = new Date(today);
    if (day==="yesterday") target.setDate(target.getDate()-1);
    if (day==="tomorrow") target.setDate(target.getDate()+1);
    const dateStr = target.toISOString().slice(0,10);
    data.goals.forEach(g => g.projects.forEach(p => p.tasks.forEach(t => {
      if (t.due===dateStr) matches.push({task:t,project:p,goal:g});
    })));
    title2 = {yesterday:"🔴 Yesterday",today:"🔵 Today",tomorrow:"🟡 Tomorrow"}[day];
    subtitle = target.toLocaleDateString("en-GB",{weekday:"long",day:"numeric",month:"long",year:"numeric"});
  }

  return (
    <div className="max-w-2xl mx-auto px-8 py-8">
      <h2 className={`text-xl font-bold mb-1 ${day==="overdue"?"text-red-600":"text-gray-900"}`}>{title2}</h2>
      <div className="text-xs text-gray-400 mb-6">{subtitle}</div>
      {matches.length === 0 ? (
        <div className="text-center text-gray-400 text-sm py-16">{day==="overdue"?"No overdue tasks 🎉":`No tasks due ${day}`}</div>
      ) : (
        <div className="space-y-2">
          {matches.map(({task,project,goal}) => (
            <div key={task.id} className={`bg-white border rounded-xl shadow-sm ${day==="overdue"?"border-red-200":"border-gray-200"}`}>
              <div className="flex items-center gap-2 px-3 py-2">
                <input type="checkbox" checked={task.status==="completed"} onChange={e=>onUpdateTask(goal.id,project.id,task.id,"status",e.target.checked?"completed":"planned")} className="accent-green-500 cursor-pointer flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className={`text-sm ${task.status==="completed"?"line-through text-gray-400":"text-gray-800"}`}>{task.title}</div>
                  <div className="text-xs text-gray-400">{goal.title} › {project.title}</div>
                </div>
                <select value={task.status} onChange={e=>onUpdateTask(goal.id,project.id,task.id,"status",e.target.value)} className={`text-xs rounded-full px-2 py-0.5 border-0 outline-none cursor-pointer font-medium ${STATUS_COLOR[task.status]}`}>
                  {STATUS.map(s=><option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
                </select>
                <button onClick={()=>setExpandedTask(expandedTask===task.id?null:task.id)} className="text-gray-300 hover:text-gray-500 text-xs">📝</button>
                <button onClick={()=>onDeleteTask(goal.id,project.id,task.id)} className="text-gray-300 hover:text-red-500 text-xs">✕</button>
              </div>
              {expandedTask===task.id && (
                <div className="px-3 pb-2">
                  <textarea className="w-full text-xs text-gray-600 bg-gray-50 border border-gray-100 rounded px-2 py-1.5 resize-none outline-none" rows={2} placeholder="Task notes…" value={task.notes} onChange={e=>onUpdateTask(goal.id,project.id,task.id,"notes",e.target.value)} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Dashboard({ data, onSelect }) {
  const totalTasks = data.goals.flatMap(g => g.projects.flatMap(p => p.tasks));
  return (
    <div className="max-w-3xl mx-auto px-8 py-8">
      <h2 className="text-xl font-bold text-gray-900 mb-6">Dashboard</h2>
      <div className="grid grid-cols-5 gap-4 mb-8">
        {[
          {label:"Goals", val:data.goals.length, color:"text-purple-600"},
          {label:"Projects", val:data.goals.reduce((a,g)=>a+g.projects.length,0), color:"text-indigo-600"},
          {label:"Total Tasks", val:totalTasks.length, color:"text-gray-700"},
          {label:"In Progress", val:totalTasks.filter(t=>t.status==="in-progress").length, color:"text-blue-600"},
          {label:"Completed", val:totalTasks.filter(t=>t.status==="completed").length, color:"text-green-600"},
        ].map(s=>(
          <div key={s.label} className="bg-white border border-gray-200 rounded-xl p-4 text-center shadow-sm">
            <div className={`text-2xl font-bold ${s.color}`}>{s.val}</div>
            <div className="text-xs text-gray-500 mt-1">{s.label}</div>
          </div>
        ))}
      </div>
      <div className="space-y-4">
        {data.goals.map(goal => (
          <div key={goal.id} className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
            <div className="flex justify-between mb-2">
              <span className="font-semibold text-gray-800">{goal.title}</span>
              <span className="text-xs text-gray-500">{calcGoalProgress(goal)}%</span>
            </div>
            <ProgressBar pct={calcGoalProgress(goal)} color={calcGoalProgress(goal)===100?"bg-green-500":"bg-blue-500"} />
            <div className="mt-3 space-y-2">
              {goal.projects.map(proj => {
                const ppct = calcProjectProgress(proj);
                return (
                  <div key={proj.id} className="cursor-pointer hover:bg-gray-50 rounded-lg px-2 py-1.5 -mx-2" onClick={()=>onSelect({goalId:goal.id,projectId:proj.id})}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-gray-700">{proj.title}</span>
                      <span className="text-gray-400">{proj.tasks.filter(t=>t.status==="completed").length}/{proj.tasks.length} tasks</span>
                    </div>
                    <ProgressBar pct={ppct} color={ppct===100?"bg-green-400":"bg-blue-400"} />
                  </div>
                );
              })}
              {goal.projects.length===0 && <div className="text-xs text-gray-400 italic">No projects yet</div>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ProjectView({ goal, project, onAddTask, onUpdateTask, onDeleteTask, onUpdateNotes }) {
  const [newTask, setNewTask] = useState("");
  const [expandedTask, setExpandedTask] = useState(null);
  const notesRef = useRef();

  useEffect(() => {
    if (notesRef.current) { notesRef.current.style.height="auto"; notesRef.current.style.height=notesRef.current.scrollHeight+"px"; }
  }, [project.notes, project.id]);

  const sorted = [...project.tasks].sort((a,b) => { if(!a.due&&!b.due)return 0; if(!a.due)return 1; if(!b.due)return -1; return a.due.localeCompare(b.due); });
  const pct = calcProjectProgress(project);

  return (
    <div className="max-w-2xl mx-auto px-8 py-8">
      <div className="mb-1 text-xs text-gray-400">{goal.title}</div>
      <h2 className="text-xl font-bold text-gray-900 mb-1">{project.title}</h2>
      <div className="flex items-center gap-3 mb-4">
        <div className="flex-1"><ProgressBar pct={pct} color={pct===100?"bg-green-500":"bg-blue-500"} /></div>
        <span className="text-xs text-gray-500">{pct}%</span>
      </div>
      <textarea ref={notesRef} rows={1} placeholder="Project notes…" value={project.notes}
        className="w-full text-xs text-gray-600 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 mb-6 resize-none outline-none focus:border-blue-300"
        style={{overflow:"hidden"}}
        onChange={e=>{onUpdateNotes(e.target.value);e.target.style.height="auto";e.target.style.height=e.target.scrollHeight+"px";}} />
      <div className="mb-6">
        <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400 bg-white"
          placeholder="Add a task and press Enter…" value={newTask}
          onChange={e=>setNewTask(e.target.value)}
          onKeyDown={e=>{if(e.key==="Enter"){onAddTask(newTask);setNewTask("");}}} />
      </div>
      <div className="space-y-1">
        {sorted.map(task=>(
          <div key={task.id} className={`bg-white border rounded-lg shadow-sm ${isOverdue(task.due)&&task.status!=="completed"?"border-red-200":"border-gray-200"}`}>
            <div className="flex items-center gap-2 px-3 py-2">
              <input type="checkbox" checked={task.status==="completed"} onChange={e=>onUpdateTask(task.id,"status",e.target.checked?"completed":"planned")} className="accent-green-500 cursor-pointer flex-shrink-0" />
              <span className={`flex-1 text-sm cursor-text ${task.status==="completed"?"line-through text-gray-400":"text-gray-800"}`}
                contentEditable suppressContentEditableWarning onBlur={e=>onUpdateTask(task.id,"title",e.target.innerText)}>{task.title}</span>
              <select value={task.status} onChange={e=>onUpdateTask(task.id,"status",e.target.value)} className={`text-xs rounded-full px-2 py-0.5 border-0 outline-none cursor-pointer font-medium ${STATUS_COLOR[task.status]}`}>
                {STATUS.map(s=><option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
              </select>
              <input type="date" value={task.due} onChange={e=>onUpdateTask(task.id,"due",e.target.value)}
                className={`text-xs border-0 outline-none bg-transparent cursor-pointer ${isOverdue(task.due)&&task.status!=="completed"?"text-red-500 font-semibold":"text-gray-400"}`} />
              <button onClick={()=>setExpandedTask(expandedTask===task.id?null:task.id)} className="text-gray-300 hover:text-gray-500 text-xs">📝</button>
              <button onClick={()=>onDeleteTask(task.id)} className="text-gray-300 hover:text-red-500 text-xs">✕</button>
            </div>
            {expandedTask===task.id && (
              <div className="px-3 pb-2">
                <textarea className="w-full text-xs text-gray-600 bg-gray-50 border border-gray-100 rounded px-2 py-1.5 resize-none outline-none focus:border-blue-300"
                  rows={2} placeholder="Task notes…" value={task.notes} onChange={e=>onUpdateTask(task.id,"notes",e.target.value)} />
              </div>
            )}
          </div>
        ))}
      </div>
      {project.tasks.length===0 && <div className="text-center text-gray-400 text-sm py-12">No tasks yet — type above and press Enter</div>}
    </div>
  );
}